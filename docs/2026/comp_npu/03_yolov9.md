# 3. Object Detection

🔗 수정한 소스코드 파일  

- [2509_warboy-vision-models.tar.gz](assets/files/2509_warboy-vision-models.tar.gz)  
- [2509_nvidia_yolo.tar.gz](assets/files/2509_nvidia-yolo.tar.gz)  
- [2509_result_img_yolov9t.zip](assets/files/2509_result_img_yolov9t.zip)  


## 3.4 Furiosa Warboy (Yolov9)

### Warboy Vision Models

🔗 [https://github.com/furiosa-ai/warboy-vision-models](https://github.com/furiosa-ai/warboy-vision-models)  

Yolo 계열 비전 모델을 쉽게 돌리고, 데모/성능 테스트까지 한 번에 해볼 수 있게 만든 실습용 스타터 키트  

📕 Yolov9 시험은 이 코드를 활용하여 수행한다.  

### 환경 구성

```shell
mkdir ~/warboy-vision-models
cd ~/warboy-vision-models

git clone https://github.com/furiosa-ai/warboy-vision-models.git

python3 -m venv venv
source venv/bin/activate

##-- (venv)
cd warboy-vision-models
```

📗 DataSet 구성 (Coco2017)  

```shell
./coco2017.sh

##-- 추후, Container화를 고려하여, 데이터를 warboy-vision-model 디렉토리 밖으로 이동(용량이 너무 커서, 이미지 크기를 증가시키기 때문)
mv -f datasets/ ../

##-- 실행결과 아래 datasets 생성 >
├── datasets
│   └── coco
│       ├── annotations
│       └── val2017
```  

📗 Post Processing utilits 빌드  

Python 기반의 모델 추론 이후에 결과를 처리하는 함수들을 C++로 구현한 뒤, build.sh를 통해 이를 **현장(in-place)**에서 빌드 및 활성화  

- Python 코드만으로는 처리하기 어려운 **후처리 작업 (post-processing)**을 고성능 C++ 확장 모듈로 구현하여 속도 향상.  
- 각각의 유틸리티 (cbox_decode, cpose_decode, cseg_decode, cbytetrack)를 개별적으로 빌드하고, 필요 시에 빠르게 활용 가능하도록 .so (shared object) 파일 생성.  

```shell
sudo apt-get update
sudo apt-get install cmake libeigen3-dev
./build.sh
```

```shell
##-- 수정된 파일 적용 
##-- warboy-vision-model 디렉토리 내 파일 수정 시, 아래 명령을 수행 후, 실행해야 한다.
pip install .
```  

📗 지원 모델 확인

```shell
ls tests/test_config/object_detection

##-- 실제 파일
(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models/tests/test_config/object_detection$ ll
total 152
drwxrwxr-x 2 kcloud kcloud 4096 Aug 12 06:52 ./
drwxrwxr-x 5 kcloud kcloud 4096 Aug 12 06:52 ../
...
-rw-rw-r-- 1 kcloud kcloud 1567 Aug 12 06:52 yolov9c.yaml
-rw-rw-r-- 1 kcloud kcloud 1567 Aug 12 06:52 yolov9e.yaml
-rw-rw-r-- 1 kcloud kcloud 1567 Aug 12 06:52 yolov9m.yaml
-rw-rw-r-- 1 kcloud kcloud 1567 Aug 12 06:52 yolov9s.yaml
-rw-rw-r-- 1 kcloud kcloud 1567 Aug 12 06:52 yolov9t.yaml
```  

### 실행 모델 설정

📗 Yolov9-t 일 경우

`cfg/object_detection/yolov9t.yaml`

```yaml
task: object_detection
model_name: yolov9t
weight: ../models/weight/object_detection/yolov9t.pt                    ##-- 내용 수정
onnx_path: ../models/onnx/object_detection/yolov9t.onnx                 ##-- 내용 수정
onnx_i8_path: ../models/quantized_onnx/object_detection/yolov9t_i8.onnx ##-- 내용 수정

calibration_params:
  calibration_method: SQNR_ASYM # calibration method
  calibration_data: ../datasets/coco/val2017                             ##-- 내용 수정
  num_calibration_data: 100                                              ##-- 내용 수정

conf_thres: 0.25
iou_thres: 0.7
input_shape: [1, 3, 640, 640]         # model input shape (batch channel Height Width) ##-- 앞의 [1, ]이 Batch size
anchors:                              # anchor information
  -
class_names:
  - person
  - bicycle
  - car
  - motorcycle
...
```  


📕 그대로 돌리면, `conf_thres`는 `0.001`로 수행된다.  

- yaml파일에 적힌 내용이 적용되지 않음  
- `src/ttest_scenarios/utils.py`에 기재된 값을 그대로 사용한다.  
    
```python
from pathlib import Path
from typing import Callable, Dict, Iterator, Tuple

import numpy as np
from pycocotools.coco import COCO

TRACE_FILE_DIR = "models/trace"

CONF_THRES = 0.001
IOU_THRES = 0.7

# CONF_THRES = 0.05
# IOU_THRES = 0.5

# ...

def set_test_engin_configs(param, num_device):
    engin_configs = []
    for idx in range(num_device):
        engin_config = {
            "name": f"test{idx}",
            "task": param["task"],
            "model": param["onnx_i8_path"],
            "worker_num": 16,
            "device": "warboy(1)*1",
            "model_type": param["model_name"],
            "input_shape": param["input_shape"][2:],
            "class_names": param["class_names"],
            "conf_thres": CONF_THRES,
            "iou_thres": IOU_THRES,
            "use_tracking": False,
        }
        engin_configs.append(engin_config)
    return engin_configs
```
    
위 set_test_engin_configs를 `src/test_scenarios/e2e/object_det.py` 에서 참조함
    
```python
from ..utils import (
    YOLO_CATEGORY_TO_COCO_CATEGORY,
    MSCOCODataLoader,
    set_test_engin_configs,
    xyxy2xywh,
)
```  

- 📕 `2025.08.27`부로 코드 업데이트 됨  

    - 🔗 [https://forums.furiosa.ai/t/warboy-vision-models-batch-size/353](https://forums.furiosa.ai/t/warboy-vision-models-batch-size/353)  


### ONNX 변환 및 양자화

```shell
warboy-vision export-onnx --config_file tutorials/cfg/yolov9t.yaml
warboy-vision quantize    --config_file tutorials/cfg/yolov9t.yaml
```  

- `export-onnx` 수행 시, 작성한 model에 대한 가중치 파일이 없으면, Web에서 다운로드 한다.  
    - `ultralytics`에서 제공하는 파일을 다운로드 한다.  
    - `src/worboy/tools/onnx_tools.py` 의 `_load_yolo_torch_model()` 참조  

        
```shell
##-- 다운로드 예>
Load PyTorch Model from ../models/weight/object_detection/yolov9t.pt...
Downloading https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov9t.pt to '../models/weight/object_detection/yolov9t.pt'
```  

- `export-onnx`는 ONNX로 변환된 `.onnx` 파일 생성  
- `quantize`는 `.onnx` 파일을 (FP기준) Warboy에서 실행 가능한 INT8로 변환  

```shell
##-- 실행 결과 >
(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ warboy-vision export-onnx --config_file tutorials/cfg/yolov9t.yaml
Load PyTorch Model from ../models/weight/object_detection/yolov9t.pt...
Downloading https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov9t.pt to '../models/weight/object_detection/yolov9t.pt': 100%|██████████| 4.74M/4.74M [
Export ONNX ../models/onnx/object_detection/yolov9t.onnx...
/home/kcloud/warboy-vision-models/venv/lib/python3.10/site-packages/ultralytics/nn/modules/head.py:163: TracerWarning: Converting a tensor to a Python boolean might cause the trace to be incorrect. We can't record the data flow of Python values, so this value will be treated as a constant in the future. This means that the trace might not generalize to other inputs!
  if self.format != "imx" and (self.dynamic or self.shape != shape):
/home/kcloud/warboy-vision-models/venv/lib/python3.10/site-packages/ultralytics/utils/tal.py:372: TracerWarning: Iterating over a tensor might cause the trace to be incorrect. Passing a tensor of different shape won't change the number of iterations executed (and might lead to errors or silently give incorrect results).
  for i, stride in enumerate(strides):
/home/kcloud/warboy-vision-models/venv/lib/python3.10/site-packages/torch/onnx/_internal/jit_utils.py:258: UserWarning: The shape inference of prim::Constant type is missing, so it may result in wrong shape inference for the exported graph. Please consider adding it in symbolic function. (Triggered internally at ../torch/csrc/jit/passes/onnx/shape_type_inference.cpp:1884.)
  _C._jit_pass_onnx_node_shape_type_inference(node, params_dict, opset_version)
/home/kcloud/warboy-vision-models/venv/lib/python3.10/site-packages/torch/onnx/utils.py:687: UserWarning: The shape inference of prim::Constant type is missing, so it may result in wrong shape inference for the exported graph. Please consider adding it in symbolic function. (Triggered internally at ../torch/csrc/jit/passes/onnx/shape_type_inference.cpp:1884.)
  _C._jit_pass_onnx_graph_shape_type_inference(
/home/kcloud/warboy-vision-models/venv/lib/python3.10/site-packages/torch/onnx/utils.py:1178: UserWarning: The shape inference of prim::Constant type is missing, so it may result in wrong shape inference for the exported graph. Please consider adding it in symbolic function. (Triggered internally at ../torch/csrc/jit/passes/onnx/shape_type_inference.cpp:1884.)
  _C._jit_pass_onnx_graph_shape_type_inference(
Export ONNX for yolov9t >> ../models/onnx/object_detection/yolov9t.onnx

(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ tree ../models/ -L 3
../models/
├── onnx
│   └── object_detection
│       └── yolov9t.onnx
└── weight
    └── object_detection
        └── yolov9t.pt

(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ warboy-vision quantize    --config_file tutorials/cfg/yolov9t.yaml
libfuriosa_hal.so --- v0.11.0, built @ 43c901f
['datasets/coco/val2017/000000097337.jpg', 'datasets/coco/val2017/000000491008.jpg', ... 'datasets/coco/val2017/000000049269.jpg', 'datasets/coco/val2017/000000239627.jpg']
calibration...: 100%|██████████████████████| 100/100 [02:51<00:00,  1.71s/it]
Quantization completed >> ../models/quantized_onnx/object_detection/yolov9t_i8.onnx

(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ tree ../models/ -L 3
../models/
├── onnx
│   └── object_detection
│       └── yolov9t.onnx
├── quantized_onnx
│   └── object_detection
│       └── yolov9t_i8.onnx
└── weight
    └── object_detection
        └── yolov9t.pt
```


### 평가

config_file인 `tutorials/cfg/yolov9t.yaml`에 작성한 `taks`를 기준으로 수행한다.  

- task는 object_detection, pose_estimation, instance_segmentation 세 가지를 지원한다.  
- 본 실험에서는 `object_detection`만 수행한다.  

```shell
##-- 모델 End-to-End 성능(후처리 포함 흐름 기준) 측정
warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml
```  


```shell
##-- 실행 결과 >

(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml
loading annotations into memory...
Done (t=0.44s)
creating index...
index created!
0.001 0.7 [None] False
0.001 0.7 [None] False
WarboyApplication - init
WarboyApplication - init
2025-08-19T03:48:20.115334Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
2025-08-19T03:48:20.122942Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2025-08-19T03:48:20.122974Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2025-08-19T03:48:20.122985Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
2025-08-19T03:48:20.134333Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
2025-08-19T03:48:20.141911Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2025-08-19T03:48:20.141942Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2025-08-19T03:48:20.141952Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
2025-08-19T03:48:20.168509Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:0 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
2025-08-19T03:48:20.168754Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2025-08-19T03:48:20.171443Z  INFO furiosa::runtime: Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250819034820-jm7npt.log
2025-08-19T03:48:20.181712Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-67eedf04 using npu:0:0
2025-08-19T03:48:20.188490Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:1 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
2025-08-19T03:48:20.188691Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2025-08-19T03:48:20.191479Z  INFO furiosa::runtime: Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250819034820-akdewy.log
2025-08-19T03:48:20.202659Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-05b07943 using npu:0:1
2025-08-19T03:48:20.228644Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-67eedf04] compiling the model (target: warboy-b0, 64dpes, file: yolov9t_i8.onnx, size: 8.4 MiB)
2025-08-19T03:48:20.248640Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-05b07943] compiling the model (target: warboy-b0, 64dpes, file: yolov9t_i8.onnx, size: 8.4 MiB)
[1/1] 🔍   Compiling from onnx to dfg
Done in 1.3403211s
✨  Finished in 1.3403455s
[1/5] 🔍   Compiling from dfg to ldfg
Done in 1.3400675s
✨  Finished in 1.3400822s
[1/5] 🔍   Compiling from dfg to ldfg
▸▹▹▹▹
▪▪▪▪▪ [1/3] Splitting graph(LAS)...Done in 79.79166s
▪▪▪▪▪ [2/3] Lowering graph(LAS)...Done in 395.7119s
▪▪▪▪▪ [3/3] Optimizing graph...Done in 1.3327444s
Done in 476.91333s
[2/5] 🔍   Compiling from ldfg to cdfg
Done in 0.03557192s
[3/5] 🔍   Compiling from cdfg to gir
Done in 0.39690518s
[4/5] 🔍   Compiling from gir to lir
Done in 0.09821692s
[5/5] 🔍   Compiling from lir to enf
Done in 12.906769s
✨  Finished in 489.3002s
2025-08-19T03:56:31.457833Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-05b07943] the model compile is successful (took 491 secs)
2025-08-19T03:56:31.516062Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 16 NPU threads on npu:0:1 (DRAM: 42.7 MiB/16.0 GiB, SRAM: 9.6 MiB/64.0 MiB)
Done in 13.15714s
✨  Finished in 490.60123s
2025-08-19T03:56:32.801868Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-67eedf04] the model compile is successful (took 492 secs)
2025-08-19T03:56:32.862281Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 16 NPU threads on npu:0:0 (DRAM: 42.7 MiB/16.0 GiB, SRAM: 9.6 MiB/64.0 MiB)
End Inference!
Loading and preparing results...
DONE (t=2.48s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=46.73s).
Accumulating evaluation results...
DONE (t=8.29s).
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.356
 Average Precision  (AP) @[ IoU=0.50      | area=   all | maxDets=100 ] = 0.499
 Average Precision  (AP) @[ IoU=0.75      | area=   all | maxDets=100 ] = 0.383
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.164
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.399
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.498
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=  1 ] = 0.293
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets= 10 ] = 0.479
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.524
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.291
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.587
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.663
yolov9t Accuracy check success! -> mAP: 0.35619624321792653 [Target: 0.3447]
```  

📗 결과 해석  

```shell
End Inference!
```  

- 모델 추론이 끝난 시점 (NPU가 이미지를 넣고 결과 tensor를 뱉는 부분까지)  

```shell
Loading and preparing results...
DONE (t=2.48s)
```  

- 추론 결과 JSON을 불러오고 포맷을 맞추는 단계 (평가 준비 단계, 후처리 X)

```shell
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=46.73s).
```  

- COCO mAP 계산을 위해 IoU 매칭·정밀도/재현율 곡선 만드는 과정  
- 성능 평가 단계 (후처리 X)

```shell
Accumulating evaluation results...
DONE (t=8.29s).
```   

- 이미지별 계산 값을 모아 최종 mAP, AR 요약 단계 (성능 평가 단계, 후처리 X)  


📗 첫 번째 실행 후, 두 번째 실행했을 때  

- 컴파일 과정 없이 바로 실행된다.  
    - ONNX/양자화 모델을 ENF(Executable NPU Format) 로 최초 컴파일  
    - Furiosa 컴파일러가 모델, 옵션, SDK 버전 등을 해시해 컴파일 캐시에 저장함  
- 같은 모델/옵션이면 캐시된 결과(ENF)를 재사용하므로  
    - ONNX → DFG 헤더 확인  
    - 캐시 히트  
- 생성 위치  

```shell
(venv) kcloud@k8s-worker2:~/.cache/furiosa/compiler$ ls
1566886977289011838.cache   18188486294625237578.cache  4379909933940904014.cache  6608453108838318400.cache  9730837875390780790.cache
17196428435497141734.cache  3099170869604100991.cache   5172788960357123168.cache  7561453431609640904.cache
```  

<br>  

📗 `warboy-vision npu-performance`는 런타임(NPU) 관점의 컴파일 및 실행 시간 측정  

```shell
##-- NPU 성능(런타임 관점) 측정
warboy-vision npu-performance   --config_file tutorials/cfg/yolov9t.yaml
```  

```shell
(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ warboy-vision npu-performance   --config_file tutorials/cfg/yolov9t.yaml
[1/6] 🔍   Compiling from onnx to dfg
Done in 1.3155711s
[2/6] 🔍   Compiling from dfg to ldfg
▪▪▪▪▪ [1/3] Splitting graph(LAS)...Done in 79.784744s
▪▪▪▪▪ [2/3] Lowering graph(LAS)...Done in 371.57333s
▪▪▪▪▪ [3/3] Optimizing graph...Done in 1.3857558s
Done in 452.818s
[3/6] 🔍   Compiling from ldfg to cdfg
Done in 0.035063144s
[4/6] 🔍   Compiling from cdfg to gir
Done in 0.39580646s
[5/6] 🔍   Compiling from gir to lir
Done in 0.10044947s
[6/6] 🔍   Compiling from lir to enf
Done in 0.21912105s
✨  Finished in 454.8841s
OpenTelemetry trace error occurred. cannot send span to the batch span processor because the channel is full
OpenTelemetry trace error occurred. cannot send span to the batch span processor because the channel is full
...
```  

- `OpenTelemetry trace error occurred. cannot send span to the batch span processor because the channel is full`  
    - 위 출력은 문제 없는 Warning 메시지라고 공식 Git Repo.에 기재되어 있다.  

📗 결과 해석  

1. ENF 컴파일 (최초 1회, 매우 오래 걸림)  
    - onnx (INT8) ➡️ 내부 그래픽 최적화(DFG → LDFG → CDFG → LIR) ➡️ ENF 실행 파일 생성   
2. ENF 로드 & 추론 실행  
    - coco val 이미지 입력 ➡️ Warboy에서 inference 수행  
3. 후처리 & 평가  
    - NMS, pycocotools로 mAP 계산   

### (ENF) 직접 생성

- 컴파일 결과를 캐시에 저장하지 않고, 파일로 생성하여 재실행 효율성을 높이기 위함
- `i8.onnx` 활용, 모델별 `enf` 파일 생성  

```shell
cd ~/warboy-vision-models/warboy-vision-models
mkdir -p ../models/enf/object_detection/

##-- batch_size 별로 생성할 수 있다.

furiosa-compiler ../models/quantized_onnx/object_detection/yolov9c_i8.onnx \ 
  -o ../models/enf/object_detection/yolov9c.enf --target-npu warboy
furiosa-compiler --batch-size 4 ../models/quantized_onnx/object_detection/yolov9c_i8.onnx \
 -o ../models/enf/object_detection/yolov9c_4b.enf --target-npu warboy
```  

```shell
##-- 실행 결과 예 >

(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ furiosa-compiler ../models/quantized_onnx/object_detection/yolov9t_i8.onnx \
  -o ../models/enf/object_detection/yolov9t.enf
[1/6] 🔍   Compiling from onnx to dfg
Done in 1.2382919s
[2/6] 🔍   Compiling from dfg to ldfg
▪▪▪▪▪ [1/3] Splitting graph(LAS)...Done in 118.841965s
▪▪▪▪▪ [2/3] Lowering graph(LAS)...Done in 508.19104s
▪▪▪▪▪ [3/3] Optimizing graph...Done in 1.4148527s
Done in 628.51996s
[3/6] 🔍   Compiling from ldfg to cdfg
Done in 0.05069953s
[4/6] 🔍   Compiling from cdfg to gir
Done in 0.4062095s
[5/6] 🔍   Compiling from gir to lir
Done in 0.1117122s
[6/6] 🔍   Compiling from lir to enf
Done in 8.699202s
✨  Finished in 639.0262s
ok: compiled successfully! (yolov9t.enf)
```  

📕 `npu-performance`가 내부적으로 더 최적화된 path (캐시 활용, multi-thread tuning)을 사용한다면, Finshied `639s > 454s`인 이유로 추측할 수 있다.  



## 3.5 Furiosa Warboy (Yolov9) 결과값 개선

📕 Warboy 에서 구현한 PipeLine (멀티프로세스 병렬 실행)을 활용  

- pipeline 없이 구현하면, `단일 프로세스/asyncio`로 구현하게 되어 추론 성능이 하락한다.

📗 mAP 뿐만 아니라, 구간별 `Inference Latency, Throughput` 결과를 출력하도록 코드 수정  

`warboy-vison-models/src/cli/performance_test/run_test_scenarios.py` 코드 수정  

- `func = object_det.test_warboy_yolo_accuracy_det`을 `func = object_det.test_warboy_yolo_performance_det`으로 변경  
- `ANNOTATION_DIR`, `IMAGE_DIR` 경로 확인  
- `click.option의()` `--batch-size` 파라미터 추가  
- batch_size 활용 func 파라미터 수정  

```python
##-- 추가
@click.option(
    "--batch-size",
    type=int,
    default=1,
    show_default=True,
    help="Override batch size for inference (default: 1).",
)
@click.option(
    "--save-samples",
    "--save-sample",
    type=int,
    default=10,
    show_default=True,
    help="Save N sample prediction images with boxes+labels to outputs/ (0=disable).",
)
@click.option(
    "--sample-start",
    type=int,
    default=1000,
    show_default=True,
    help="Global index start (0-based). 1000 means 1001st image.",
)

##-- 수정
def run_e2e_test(config_file: str, batch_size: int, save_samples: int, sample_start: int):
    ##-- 수정
    ANNOTATION_DIR = (
        "../datasets/coco/annotations"  # CHECK you may change this to your own path
    )

    ##-- 수정
    IMAGE_DIR = "../datasets/coco/val2017"  # CHECK you may change this to your own path

    param = get_model_params_from_cfg(config_file)

    if param["task"] == "object_detection":
        ##-- 수정
        #func = object_det.test_warboy_yolo_accuracy_det
        func = object_det.test_warboy_yolo_performance_det
        annotation = f"{ANNOTATION_DIR}/instances_val2017.json"
        image_dir = IMAGE_DIR

    elif param["task"] == "pose_estimation":
        func = pose_est.test_warboy_yolo_accuracy_pose
        annotation = f"{ANNOTATION_DIR}/person_keypoints_val2017.json"
        image_dir = IMAGE_DIR

    elif param["task"] == "instance_segmentation":
        func = instance_seg.test_warboy_yolo_accuracy_seg
        annotation = f"{ANNOTATION_DIR}/instances_val2017.json"
        image_dir = IMAGE_DIR

    else:
        raise ValueError(
            "Invalid task type. Choose from 'object_detection', 'pose_estimation', or 'instance_segmentation'."
        )

    ##-- 수정
    func(config_file, image_dir, annotation, batch_size=batch_size, save_samples=save_samples, sample_start=sample_start)
```  


`warboy-vision-models/src/warboy/runtime/warboy_runtime.py`

- `.enf` 파일 유무에 따라, 추론/onnx 생성 분기  
- batch_size 지정 적용    
    - bs=1 은 기존 동작 유지  
        - `await, self.model.predict()`: Warboy 추론 함수(FuriosaRTModel)
    - bs>1 은 입력을 모아 (B, C, H, W)로 하나의 `ndarray`를 `predict()`에 전달  
        - 고정 배치 ENF는 항상 정확히 B개가 들어와야함
    - bs>1 은 디바이스 출력(heads)을 per-image로 슬라이스해서 (1, C, H, W) 형태로 후처리에 전달  
        - 후처리는 per-image (1, C, H, W)를 기대하므로 **슬라이스/복원** 필요
- 잔여 배치 패딩 추가  
    - 데이터셋 끝에서 B보다 적게 남은 샘플은 마지막 샘플을 복제해서 정확히 B개로 채운 뒤 실행  
    - 추론 시간 분배는 B 기준      
- latency 측정용 코드 추가  
- 추론 시간 측정  

```diff
+import numpy as np
 
 class WarboyApplication:
##-- ..
         device: str,
         stream_mux_list: List[PipeLineQueue],
         output_mux_list: List[PipeLineQueue],
+        batch_size: int = 1,
+        timings = None,
     ):
-        self.config = {"model": model, "worker_num": worker_num, "npu_device": device}
-        self.model = FuriosaRTModel(
-            FuriosaRTModelConfig(name="YOLO", batch_size=1, **self.config)
-        )      
+        if model.endswith(".enf"):
+            print(f"[WarboyApplication] Loading precompiled ENF: {model}")
+            self.config = {
+                "model": model,
+                "worker_num": worker_num,
+                "npu_device": device,
+            }
+            self.model = FuriosaRTModel(
+                FuriosaRTModelConfig(
+                    name="YOLO",                  
+                    **self.config
+                )
+            )
+        else:
+            print(f"[WarboyApplication] Loading ONNX (will compile): {model}")
+            self.config = {
+                "model": model,
+                "worker_num": worker_num,
+                "npu_device": device,
+            }
+            self.model = FuriosaRTModel(
+                FuriosaRTModelConfig(
+                    name="YOLO",
+                    batch_size=batch_size,
+                    **self.config
+                )
+            )        
+        
+        self.batch_size = batch_size
         self.stream_mux_list = stream_mux_list
         self.output_mux_list = output_mux_list
+
+        self.timings = timings
         print("WarboyApplication - init")
```  

- `batch_size == 1`, `batch_size > 1`일 경우 Queue 입력 분기

```diff
     async def inference(
         self, video_channel: int, stream_mux: PipeLineQueue, output_mux: PipeLineQueue
     ):
+        #  batch_size == 1
+        if self.batch_size == 1:
+            while True:
+                try:
+                    input_, img_idx = stream_mux.get()
+                except QueueClosedError:
+                    break
+
+                t2 = time.perf_counter()
+                output = await self.model.predict(input_)
+
+                if img_idx < 2:  # 처음 몇 장만
+                    print("[DEBUG bs=1]", type(output), getattr(output, "shape", None))
+                    if isinstance(output, (list, tuple)):
+                        for j, head in enumerate(output):
+                            print(f"  head{j}:", type(head), getattr(head, "shape", None))
+
+                t3 = time.perf_counter()
+                infer_ms = (t3 - t2) * 1000.0
+
+                if self.timings is not None:
+                    d = dict(self.timings.get(img_idx, {}))
+                    d["infer"] = infer_ms
+                    d["t2"] = t2
+                    self.timings[img_idx] = d
+                    if img_idx < 5:
+                        print(f"[Runtime] {img_idx} infer={infer_ms:.3f} ms")
+
+                output_mux.put(output) 
+
+            output_mux.put(StopSig)
+            return
+
+        #  batch_size > 1 → 배치 모드
+        batch_inputs, batch_indices = [], []
+
+        def _norm_head_per_image(head: np.ndarray, i: int):
+            """
+            배치 ENF가 평탄화해서 내보내는 head를
+            postprocessor가 기대하는 (1, C, H, W)로 되돌린다.
+            """
+            if not isinstance(head, np.ndarray):
+                return head
+
+            arr = head
+
+            # 1) 배치축이 있는 경우 per-image로 슬라이스
+            if arr.ndim == 4 and arr.shape[0] > i:
+                # (B, C, H, W) → (1, C, H, W)
+                return arr[i:i+1]
+            if arr.ndim == 3 and arr.shape[0] == self.batch_size and arr.shape[0] > i:
+                # (B, C*H, W) 같은 형태 → i 슬라이스 후 아래에서 복원
+                arr = arr[i]
+
+            # 2) per-image 상태에서 모양 복원
+            if arr.ndim == 3:
+                # (C, H, W) → (1, C, H, W)
+                return arr[None, ...]
+            if arr.ndim == 2:
+                # (C*H, W) → (1, C, H, W), 여기서 H=W 가정
+                W = arr.shape[1]
+                H = W
+                C = arr.shape[0] // H if H > 0 else 0
+                if C * H == arr.shape[0] and C > 0:
+                    return arr.reshape(1, C, H, W)
+                return arr
+
+            return arr
+
+        def _per_image(outputs, i):
+            if isinstance(outputs, (list, tuple)):
+                fixed = [ _norm_head_per_image(h, i) for h in outputs ]
+                return type(outputs)(fixed)
+            if isinstance(outputs, np.ndarray):
+                return _norm_head_per_image(outputs, i)
+            return outputs
+
+        def _emit(outputs, infer_ms, t2, B_effective=None):
+            """
+            B_effective: 추론 시간 분배에 사용할 배치 크기
+            - 정규 배치: len(batch_indices) == self.batch_size
+            - 잔여 패딩 배치: self.batch_size (HW 관점으로 분배)
+            """
+            B = B_effective if B_effective is not None else len(batch_indices)
+            for i, idx in enumerate(batch_indices):
+                # 디버깅: bs>1 구조 확인
+                if idx < 2:
+                    def _peek(x):
+                        if isinstance(x, (list, tuple)):
+                            return [ (getattr(a, 'shape', None)) for a in x ]
+                        return getattr(x, 'shape', None)
+                    print(f"[DEBUG bs>1] out_i structure: {_peek(out_i)}")
+
+                out_i = _per_image(outputs, i)
+                if self.timings is not None:
+                    d = dict(self.timings.get(idx, {}))
+                    d["infer"] = infer_ms / B
+                    d["t2"] = t2
+                    d["batch_size"] = B
+                    self.timings[idx] = d
+                output_mux.put(out_i)
 
         while True:
-            t1 = time.time()
             try:
-                input_, _ = stream_mux.get()
+                input_, img_idx = stream_mux.get()
+                batch_inputs.append(input_)
+                batch_indices.append(img_idx)
+
+                if len(batch_inputs) < self.batch_size:
+                    continue
+
             except QueueClosedError:
-                # print(f"Video-Channel - {video_channel} End!")
+                if batch_inputs:
+                    actual = len(batch_inputs)
+                    if actual < self.batch_size:
+                        pad_needed = self.batch_size - actual
+                        batch_inputs_padded = batch_inputs + [batch_inputs[-1]] * pad_needed
+                    else:
+                        batch_inputs_padded = batch_inputs
+
+                    batched_input = np.concatenate(batch_inputs_padded, axis=0)  # (B,C,H,W)
+                    t2 = time.perf_counter()
+                    outputs = await self.model.predict(batched_input)
+                    t3 = time.perf_counter()
+                    infer_ms = (t3 - t2) * 1000.0
+
+                    # 패딩 실행 → 분배는 B=self.batch_size 기준
+                    _emit(outputs, infer_ms, t2, B_effective=self.batch_size)
                 break
-            output = await self.model.predict(input_)
-            output_mux.put(output)
+
+            # 정규 배치 실행
+            batch_input = np.concatenate(batch_inputs, axis=0)  # (B,C,H,W)
+            t2 = time.perf_counter()
+            outputs = await self.model.predict(batch_input)
+            t3 = time.perf_counter()
+            infer_ms = (t3 - t2) * 1000.0
+            
+            _emit(outputs, infer_ms, t2)
+            batch_inputs, batch_indices = [], []
 
         output_mux.put(StopSig)
         return
```  

`warboy-vision-models/src/warboy/utils/image_decoder.py`

- latency 측정용 코드 추가  
- `t0` 시간 저장 (Preprocess 시작 시각)  
    - Preprocess 실행 시간 측정  


```diff
 from ..yolo.preprocess import YoloPreProcessor
 from .queue import PipeLineQueue, QueueClosedError, StopSig
 
+import time
+from pathlib import Path

 class ImageListDecoder:
     def __init__(
         self,
         image_list: List,
         stream_mux: PipeLineQueue,
         frame_mux: PipeLineQueue,
         preprocess_function: Callable = YoloPreProcessor(),
+        timings = None,
     ):
         self.image_paths = PipeLineQueue()
         for image in image_list:
             self.image_paths.put(image.image_info)
         self.image_paths.put(StopSig)

         self.preprocessor = preprocess_function
         self.stream_mux = stream_mux
         self.frame_mux = frame_mux
+        self.timings = timings
 
     def run(self):
         img_idx = 0
         while True:
             try:
                 image_path = self.image_paths.get()
                 img = cv2.imread(image_path)
+                
+                t0 = time.perf_counter()
                 input_, context = self.preprocessor(img)
+                t1 = time.perf_counter()
+                pre_ms = (t1 - t0) * 1000.0
+
+                if self.timings is not None:
+                    d = dict(self.timings.get(img_idx, {}))  # 기존 값 복사
+                    d["pre"] = pre_ms
+                    d["t0"] = t0
+                    self.timings[img_idx] = d               # 새 dict로 교체
+
+                    if img_idx < 5:
+                        print(f"[Decoder] {img_idx} pre={pre_ms:.3f} ms")

+                # 원본 이미지 경로를 컨텍스트에 담아 PredictionEncoder까지 전달
+                # image_list 요소는 보통 image.image_info에 경로가 들어있음
+                try:
+                    image_path = getattr(self.image_list[img_idx], "image_info", None)
+                except Exception:
+                    image_path = None
+                if not isinstance(context, dict):
+                    context = {}
+                if image_path is not None:
+                    context["image_path"] = str(image_path)

                 self.stream_mux.put((input_, img_idx))
                 self.frame_mux.put((img, context, img_idx))
                 img_idx += 1
```  

`warboy-vision-models/src/warboy/utils/image_encoder.py`

- latency 측정용 코드 추가 (t0, t1, lat_infer)  
- post ms, e2e_active(합), e2e_wall(`time.perf_counter()-t0)` 기록  


```diff
-from typing import Callable
+from typing import Callable, List, Optional

+from pathlib import Path
+import cv2, numpy as np

class PredictionEncoder:

##-- .. 

class PredictionEncoder:
    def __init__(

##-- .. 
        postprocess_function: Callable,
+       timings = None,
+       class_names: Optional[List[str]] = None,
+       save_samples: int = 0,
+       sample_start: int = 1001,   # COCO stem ID 시작 기본값(요청대로 1001)
+       save_dir: str = "outputs",
+       sample_by: str = "stem",    # "stem" | "index" (기본 stem)       
+       batch_size: int = 1, 
    ):
##-- .. 
        self.postprocessor = postprocess_function
+       self.timings = timings
+       self.class_names = class_names or []
+       self.save_samples = int(save_samples or 0)
+       self.sample_start = int(sample_start or 0)
+       self.save_dir = Path(save_dir)
+       self.sample_by = sample_by
+       self.save_dir_root = Path(save_dir)
+       self.batch_size = batch_size

    def run(self):
        while True:
            try:
                frame, context, img_idx = self.frame_mux.get()
                output = self.output_mux.get()

+               t4 = time.perf_counter()
                preds = self.postprocessor(output, context, frame.shape[:2])
+               t5 = time.perf_counter()
+               post_ms = (t5 - t4) * 1000.0

+               if self.timings is not None:
+                   d = dict(self.timings.get(img_idx, {}))
+                   d["post"] = post_ms
+                   pre_ms = d.get("pre", 0.0)
+                   infer_ms = d.get("infer", 0.0)
+                   e2e_active = pre_ms + infer_ms + post_ms
+                   d["e2e_active"] = e2e_active

+                   self.timings[img_idx] = d

+                   if img_idx < 5:
+                       #e2e_wall_str = f"{e2e_wall_val:.3f} ms" if e2e_wall_val else "NA"
+                       #print(f"[Encoder] {img_idx} post={post_ms:.3f} ms "
+                       #    f"e2e_active={e2e_active:.3f} ms "
+                       #    f"e2e_wall={e2e_wall_str}")
+                       e2e_val = d.get("e2e")
+                       e2e_wall_str = f"{e2e_val:.3f} ms" if e2e_val is not None else "NA"
+                       print(f"[Encoder] {img_idx} post={post_ms:.3f} ms "
+                             f"e2e_active={e2e_active:.3f} ms "
+                             f"e2e_wall={e2e_wall_str}")                           

+               # -------------------------------
+               # 샘플 저장 (bbox + label)
+               # -------------------------------
+               if self.save_samples > 0:
+                   # 저장 대상인지 판정
+                   should_save = False
+
+                   # 컨텍스트/인덱스 확보
+                   img_path = None
+                   if isinstance(context, dict):
+                       img_path = context.get("image_path")

+                   if self.sample_by == "stem" and img_path:
+                       # COCO 파일명 → 정수 stem ID
+                       try:
+                           stem_id = int(Path(img_path).stem)
+                       except Exception:
+                           stem_id = None
+                       if stem_id is not None:
+                           if self.sample_start <= stem_id < self.sample_start + self.save_samples:
+                               should_save = True
+                   else:
+                       # index 방식 (전/후방 호환)
+                       if self.sample_start <= img_idx + 1 < self.sample_start + self.save_samples:
+                           should_save = True

+                   if should_save:
+                       draw = frame.copy()
+                       # preds 형상 표준화: (N, >=6) [x1,y1,x2,y2,conf,cls]
+                       dets = preds[0] if isinstance(preds, (list, tuple)) else preds
+                       if dets is not None:
+                           nd = np.asarray(dets)
+                           if nd.ndim == 2 and nd.shape[1] >= 6 and nd.shape[0] > 0:
+                               for row in nd:
+                                   x1, y1, x2, y2, conf, cls = row[:6]
+                                   p1 = (int(x1), int(y1))
+                                   p2 = (int(x2), int(y2))
+                                   cv2.rectangle(draw, p1, p2, (0, 255, 0), 2)
                                    
+                                   # 클래스 이름 매핑
+                                   name = (
+                                       self.class_names[int(cls)]
+                                       if self.class_names and 0 <= int(cls) < len(self.class_names)
+                                       else str(int(cls))
+                                   )
+                                   label = f"{name} {float(conf):.2f}"
+                                   cv2.putText(draw, label, (p1[0], max(p1[1]-4, 0)),
+                                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 1)

+                       # 저장 경로: outputs/{model명}_{batch_size}/
+                       stem = Path(img_path).stem if img_path else f"{img_idx:06d}"
+                       model_bs_dir = self.save_dir_root.parent / f"{self.save_dir_root.name}_{self.batch_size}"
+                       model_bs_dir.mkdir(parents=True, exist_ok=True)
+                       out_path = model_bs_dir / f"{stem}_pred.jpg"
+                       cv2.imwrite(str(out_path), draw)
                   
                if not self.result_mux is None:
                    self.result_mux.put((preds, 0.0, img_idx))
            except QueueClosedError:
                if not self.result_mux is None:
                    self.result_mux.put(StopSig)
                break
            except Exception as e:
                print(f"Error PredictionEncoder: {e}")
                break  
```

`warboy-vision-models/src/warboy/utils/process_pipeline.py`

- latency 측정용 코드 추가 (t0, t1, lat_infer)  
- 멀티프로세스 파이프라인 생성 후, Queue 기반으로 아래 과정을 수행  
    - 입력 (이미지 디코딩)  
    - 전처리 → 추론 → 후처리  
    - 출력 (e2e 테스트)  
- 구성요소  
    - `Engine`: 추론 엔진 설정  
        - 모델 경로, 배치 크기, device, conf, iou 값 보관  
        - 등록되면 `YoloPreProcessor`, `get_post_processor` 설정  
    - `Input`: 입력 소스  
        - `ImageList`: 이미지 리스트 입력 (`ImageListDecoder`)  
        - `frame_mux` 큐에 디코딩된 frame + context 를 전달  
    - `Runtime`: 추론 실행기  
        - `WarboyApplication`: 실제 ENF 모델 실행, NPU 런 타임  
        - `strea_mux` → 추론 → `output_mux`  
    - `Encoder`: 출력/후처리  
        - `ImageEncoder`:  후처리(postprocess) 후 시각화 (bbox draw된 이미지 반환)  
        - `PredictionEncoder`: 후처리 후, raw prediction 반환  
    - `Handler`: 결과 처리  
        - `output_stream_handler`: FPS overlay 후 화면 출력 (grid 형식)  
        - `output_image_handler`: ./outputs/에 결과 이미지 저장  
        - `output_e2e_test_handler`: E2E 벤치마크 모드 → outputs dict에 결과 저장  


```diff
##-- ..

@dataclass
class Engine:
##-- ..
    use_tracking: bool = True
+   batch_size: int = 1

    def _get_runtime_info(self):
        return

    def _get_func_info(self):
        return

##-- ..

class PipeLine:
    def __init__(
        self,
        num_channels: int,
        run_fast_api: bool = True,
        run_e2e_test: bool = False,
        make_image_output: bool = False,
+       timings = None,
+       save_samples: int = 0,
+       sample_start: int = 1001,
+       save_dir: str = "outputs",
+       sample_by: str = "stem",
+       class_names = None,
    ):

##-- ..

        self.results = []

+       self.timings = timings if timings is not None else {}
+       self.save_samples = save_samples
+       self.sample_start = sample_start
+       self.save_dir = save_dir
+       self.sample_by = sample_by
+       self.class_names = class_names or []


    def add(self, obj, name: str = "", postprocess_as_img=True):
        if isinstance(obj, Engine):
+           batch_size = obj.batch_size
            self.runtime_info[obj.name] = {
                "model": obj.model,
                "worker_num": obj.worker_num,
                "device": obj.device,
+               "batch_size": obj.batch_size,
+               "conf_thres": obj.conf_thres,
+               "iou_thres": obj.iou_thres,
            }
+           import json
+           print(f"[Pipeline.add] Engine registered: {json.dumps(self.runtime_info[obj.name], indent=2)}")

            if "yolo" in obj.model:
                self.preprocess_functions[obj.name] = YoloPreProcessor(
                    new_shape=obj.input_shape, tensor_type="uint8"
                )
            else:
                raise "Error: not implemented model type"
            if postprocess_as_img:
##-- ..
        elif isinstance(obj, Video):
##-- ..
        elif isinstance(obj, ImageList):
##-- ..
            # Preprocess
            self.video_decoder_process.append(
                ImageListDecoder(
                    obj.image_list,
                    stream_mux=new_stream_mux,
                    frame_mux=new_frame_mux,
                    preprocess_function=self.preprocess_functions[name],
+                   timings=self.timings,
                )
            )
            # Postprocess (draw bbox for object detection)
            if postprocess_as_img:
                self.image_encoder_process.append(
                    ImageEncoder(
                        frame_mux=new_frame_mux,
                        output_mux=new_output_mux,
                        result_mux=new_result_mux,
                        postprocess_function=self.postprocess_functions[name],
+                       timings=self.timings,
                    )
                )
            else:
                self.image_encoder_process.append(
                    PredictionEncoder(
                        frame_mux=new_frame_mux,
                        output_mux=new_output_mux,
                        result_mux=new_result_mux,
                        postprocess_function=self.postprocess_functions[name],
+                       timings=self.timings,
+                       save_samples=self.save_samples,
+                       sample_start=self.sample_start,
+                       save_dir=self.save_dir,     
+                       class_names=self.class_names,
+                       sample_by=self.sample_by,
+                       batch_size=self.runtime_info[name]["batch_size"],
                    )
                )
        else:
            raise "Error: not implemented type"

    def run(self, runtime_type: str = "application"):
        if runtime_type == "application":
            runtime_process = [
                WarboyApplication(
                    model=runtime_info["model"],
                    worker_num=runtime_info["worker_num"],
                    device=runtime_info["device"],
                    stream_mux_list=self.stream_mux_list[name],
                    output_mux_list=self.output_mux_list[name],
+                   batch_size=runtime_info["batch_size"],
+                   timings=self.timings,
                )
                for name, runtime_info in self.runtime_info.items()
            ]
        elif runtime_type == "queue":
            runtime_process = [
                WarboyQueueRuntime(
                    model=runtime_info["model"],
                    worker_num=runtime_info["worker_num"],
                    device=runtime_info["device"],
                    stream_mux_list=self.stream_mux_list[name],
                    output_mux_list=self.output_mux_list[name],
                )
                for name, runtime_info in self.runtime_info.items()
            ]
        else:
            raise "Error: runtime_type must be queue or application"

        try:
##-- ..
```  

`warboy-vison-models/src/test_scenarios/e2e/object_det.py`  

- test_warboy_yolo_performance_det() 생성     
- quantiles() 는 입력된 숫자 리스트 `arr`의 통계값 도출  
    - latency나 throughput 값을 여러 번 측정한 뒤, 평균/중앙값/상위10%/상위1% 지연시간 같은 통계를 한 번에 요약  
    - 평균값 (mean), 중앙값 (p50), 90 분위수 (p90), 99 분위수 (p99)  
- warboy의 pipeline 실행 후, 전/후처리 및 추론 시간 평균을 수집하여 json 형태로 출력  
    - `wall_start` → `task.run()` → `wall_end`
- Coco 평가까지 한 번에 수행해 **mAP**와 `Target` 대비 **성공/실패** 로그 출력  
- 기존 `test_warboy_yolo_accuracy_det()`기준,   
    - 컴파일된 바이너리 점검 로직 추가  
    - batch_size별 실행 추가  
    - task.run() 전,후로 시간 측정  
    - latency, throughput 계산 로직 추가  


```python
##-- ... 
##-- 추가
import cv2
import json
from typing import List
import asyncio
import time
from statistics import mean, median
import numpy as np
from pathlib import Path

from ...warboy.yolo.postprocess import ObjDetPostprocess

##-- 추가
# ------------------------------------------------------
# Config
# ------------------------------------------------------
ENF_DIR = Path("../models/enf")
QUANTIZED_ONNX_DIR = "quantized_onnx"

# COCO 80 클래스 이름 (YOLO order)
COCO_NAMES = [
 "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat","traffic light",
 "fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse","sheep","cow",
 "elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase","frisbee",
 "skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket","bottle",
 "wine glass","cup","fork","knife","spoon","bowl","banana","apple","sandwich","orange",
 "broccoli","carrot","hot dog","pizza","donut","cake","chair","couch","potted plant","bed",
 "dining table","toilet","tv","laptop","mouse","remote","keyboard","cell phone","microwave","oven",
 "toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear","hair drier","toothbrush"
]


##-- ... 

##-- ... 
##-- 추가
# ------------------------------------------------------
# Helpers
# ------------------------------------------------------
def quantiles(arr: List[float]):
    if not arr:
        return (None, None, None, None)
    arr_sorted = sorted(arr)
    p50 = median(arr_sorted)

    def pick(p):
        if len(arr_sorted) < 100 and p == 0.99:
            return None
        if len(arr_sorted) < 10 and p == 0.90:
            return None
        idx = max(0, min(len(arr_sorted)-1, int(p * len(arr_sorted)) - 1))
        return arr_sorted[idx]
    
    return (mean(arr_sorted), p50, pick(0.90), pick(0.99))
##-- ... 

##-- 추가
def test_warboy_yolo_performance_det(config_file: str, image_dir: str, annotation_file: str,
                                     use_enf=True, batch_size: int=1, save_samples: int=0, sample_start: int=1001):
    """성능/정확도 테스트: latency, throughput, mAP"""

    param = get_model_params_from_cfg(config_file)
    model_name = param["model_name"]
    input_shape = param["input_shape"] 

    # YAML 기반 conf/iou
    engin_configs = set_test_engin_configs(param, 1)

    # ENF 경로 확인
    if use_enf:
        enf_file = f"{model_name}_{batch_size}b.enf" if batch_size > 1 else f"{model_name}.enf"
        enf_path = ENF_DIR / param["task"] / enf_file
        if enf_path.is_file(): model_path = str(enf_path)
        else: raise FileNotFoundError(f"ENF file not found: {enf_path}")
    else:
        model_path = param.get("onnx_i8_path") or os.path.join(QUANTIZED_ONNX_DIR, param["task"], param["onnx_i8_path"])

    # 이미지 준비
    image_names = sorted(
        [n for n in os.listdir(image_dir) if n.lower().endswith((".jpg",".jpeg",".png"))]
    )
    images = [Image(image_info=os.path.join(image_dir, n)) for n in image_names]

    preprocessor = YoloPreProcessor(new_shape=input_shape[2:])
    data_loader = MSCOCODataLoader(Path(image_dir), Path(annotation_file), preprocessor, input_shape)

    # shared timings
    manager = Manager()
    TIMINGS = manager.dict()

    # Pipeline
    #outputs/<model_name> 초기화 (요청 시)
    import shutil
    save_dir = Path("outputs") / model_name
    if save_samples > 0:
        if save_dir.exists():
            shutil.rmtree(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)

    # Pipeline
    task = PipeLine(run_fast_api=False,
                    run_e2e_test=True,
                    num_channels=len(images),
                    timings=TIMINGS,
                    save_samples=save_samples,
                    sample_start=sample_start,
                    save_dir=str(save_dir),
                    sample_by="stem",
                    class_names=COCO_NAMES,)

    for idx, engin in enumerate(engin_configs):
        engin["model"] = model_path
        #print("[Engine Config]", json.dumps(engin, indent=2, default=str)) 
        task.add(Engine(**engin, batch_size=batch_size), postprocess_as_img=False)
        task.add(ImageList([image for image in images[idx::len(engin_configs)]]),
                 name=engin["name"], postprocess_as_img=False)

    wall_start = time.time()
    task.run()
    wall_elapsed = time.time() - wall_start

    print(f"Inference Done in {wall_elapsed:.2f} sec")

    # latency 요약
    pre_list, infer_list, post_list, e2e_active_list = [], [], [], []
    for timings in TIMINGS.values():
        if "pre" in timings: pre_list.append(timings["pre"])
        if "infer" in timings: infer_list.append(timings["infer"])
        if "post" in timings: post_list.append(timings["post"])
        if "e2e_active" in timings: e2e_active_list.append(timings["e2e_active"])
        if "e2e" in timings: e2e_wall_list.append(timings["e2e"])

    def summarize(xs): 
        return {"avg": float(np.mean(xs)), "p50": float(np.median(xs))} if xs else {}

    summary = {
        "model": model_name,  # 파일 경로 대신 모델명만
        "cfg": os.path.basename(config_file),
        "images": len(pre_list),
        "throughput_img_per_s": {
            "e2e_active": 1000.0 / summarize(e2e_active_list).get("avg", np.nan),
            "infer_only": 1000.0 / summarize(infer_list).get("avg", np.nan),            
        },
        "latency_ms": {
            "pre": summarize(pre_list),
            "infer": summarize(infer_list),
            "post": summarize(post_list),
            "e2e_active": summarize(e2e_active_list),            
        },
        "dataset_img_per_s": {
            "throughput_wall": len(pre_list) / wall_elapsed if wall_elapsed > 0 else None
        }
    }
    print(json.dumps(summary, indent=2))

    # COCO mAP
    results = _process_outputs(task.outputs, data_loader)
    coco_result = data_loader.coco.loadRes(results)
    coco_eval = COCOeval(data_loader.coco, coco_result, "bbox")
    coco_eval.evaluate(); coco_eval.accumulate(); coco_eval.summarize()

    mAP = coco_eval.stats[0]
    target = TARGET_ACCURACY.get(model_name, 0.3) * 0.9
    if mAP >= target:
        print(f"{model_name} Accuracy check success! -> mAP: {mAP} [Target: {target}]")
    else:
        print(f"{model_name} Accuracy check failed! -> mAP: {mAP} [Target: {target}]")
```  

`warboy-vison-models/src/test_scenarios/utils.py`
- `tutorials/cfg/yolov9t.yaml` 의 conf_thres, iou_thres 값을 참조하도록 변경

```python
def set_test_engin_configs(param, num_device):
    engin_configs = []
    for idx in range(num_device):
        engin_config = {
            "name": f"test{idx}",
            "task": param["task"],
            "model": param["onnx_i8_path"],
            "worker_num": 16,
            "device": "warboy(1)*1",
            "model_type": param["model_name"],
            "input_shape": param["input_shape"][2:],
            "class_names": param["class_names"],
            
            ## -- 수정
            #"conf_thres": CONF_THRES,
            #"iou_thres": IOU_THRES,
            "conf_thres": float(param.get("conf_thres", CONF_THRES)),
            "iou_thres": float(param.get("iou_thres", IOU_THRES)),
            
            "use_tracking": False,
        }
        engin_configs.append(engin_config)
    return engin_configs
```  



### 배치사이즈별 성능 시험

📗 배치사이즈별 enf 생성

`model-list.yaml`  

- 컴파일을 수행할 model 정의  

```yaml
model_list:
  - yolov8n
  - yolov8l
  - yolov9t
  - yolov9c
```

`build_enf_batchsize.py`  

- `model-list.yaml`을 기준으로, batch_size별 enf 생성  
- 내부적으로 `furiosa-complier` 명령어를 사용한다.  

```python
#!/usr/bin/env python3
"""
Automate YOLO -> ONNX -> INT8 -> ENF build pipeline for warboy-vision-models.

Update:
- Compiler failure now logs a warning and skips to next instead of raising RuntimeError.
- Spinner is preserved for console feedback, but spinner characters are not written to log file.
"""
from __future__ import annotations
import argparse
import os
import sys
import yaml
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
import itertools, time, threading

BATCH_SIZES = [None, 4, 8, 16, 32]
DEFAULT_TASK = "object_detection"
DEFAULT_TEMPLATE_CFG = Path("tutorials/cfg/yolov8n.yaml")
CFG_DIR = Path("tutorials/cfg")
MODELS_DIR = Path("../models")
WEIGHT_DIR = MODELS_DIR / "weight" / DEFAULT_TASK
ONNX_DIR = MODELS_DIR / "onnx" / DEFAULT_TASK
QONNX_DIR = MODELS_DIR / "quantized_onnx" / DEFAULT_TASK
ENF_DIR = MODELS_DIR / "enf" / DEFAULT_TASK
MODEL_LIST_FILE = Path("model-list.yaml")
CALIB_DATA = Path("../datasets/coco/val2017")
LOG_FILE = Path("pipeline.log")

def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def run_cmd(cmd: list[str], cwd: Path | None = None) -> int:
    log(f"RUN: {' '.join(cmd)} (cwd={cwd or Path.cwd()})")
    with LOG_FILE.open("a", encoding="utf-8") as f:
        proc = subprocess.Popen(
            cmd,
            cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            # write only to console, not spinner chars to log
            sys.stdout.write(line)
            f.write(line)
        proc.wait()
        return proc.returncode

def read_model_list(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data.get("model_list", [])

def ensure_cfg_for_model(model: str, template_cfg: Path = DEFAULT_TEMPLATE_CFG) -> Path:
    CFG_DIR.mkdir(parents=True, exist_ok=True)
    cfg_path = CFG_DIR / f"{model}.yaml"
    if not cfg_path.exists():
        shutil.copyfile(template_cfg, cfg_path)
        log(f"Created cfg from template: {cfg_path}")
    with cfg_path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    cfg["task"] = DEFAULT_TASK
    cfg["model_name"] = model
    cfg["weight"] = str(WEIGHT_DIR / f"{model}.pt")
    cfg["onnx_path"] = str(ONNX_DIR / f"{model}.onnx")
    cfg["onnx_i8_path"] = str(QONNX_DIR / f"{model}_i8.onnx")
    cfg["calibration_params"] = {
        "calibration_method": "SQNR_ASYM",
        "calibration_data": str(CALIB_DATA),
        "num_calibration_data": 100,
    }
    with cfg_path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, sort_keys=False)
    return cfg_path

def expected_paths_for_model(model: str) -> dict[str, Path]:
    return {
        "weight": WEIGHT_DIR / f"{model}.pt",
        "onnx": ONNX_DIR / f"{model}.onnx",
        "qonnx": QONNX_DIR / f"{model}_i8.onnx",
        "enf_1": ENF_DIR / f"{model}.enf",
        "enf_4": ENF_DIR / f"{model}_4b.enf",
        "enf_8": ENF_DIR / f"{model}_8b.enf",
        "enf_16": ENF_DIR / f"{model}_16b.enf",
        "enf_32": ENF_DIR / f"{model}_32b.enf",
    }

def spinner(msg="컴파일 중..."):
    stop_flag = {"done": False}
    def run():
        for c in itertools.cycle('|/-\\'):
            if stop_flag["done"]:
                break
            sys.stderr.write(f'\r{msg} {c}')
            sys.stderr.flush()
            time.sleep(0.2)
        sys.stderr.write('\r완료!     \n')
        sys.stderr.flush()
    t = threading.Thread(target=run)
    t.daemon = True
    t.start()
    return lambda: stop_flag.update({"done": True})

def compile_enf_for_model(model: str, qonnx: Path):
    ENF_DIR.mkdir(parents=True, exist_ok=True)

    # BATCH_SIZES 기반 출력 경로 정의
    batch_map = {
        bs: (ENF_DIR / f"{model}.enf" if bs is None else ENF_DIR / f"{model}_{bs}b.enf")
        for bs in BATCH_SIZES
    }

    for bs, out_path in batch_map.items():
        if out_path.exists():
            log(f"[SKIP] ENF exists for {model} batch={1 if bs is None else bs}")
            continue

        cmd = ["furiosa-compiler", str(qonnx), "-o", str(out_path),
               "--target-npu", "warboy"]   #  64 DPES 장치 맞춤 설정 추가

        if bs is not None:  # batch=1(None)은 옵션 안 붙음
            cmd += ["--batch-size", str(bs)]

        rc = run_cmd(cmd)
        if rc != 0 or not out_path.exists():
            log(f"[WARN] Compiler failed for {out_path}, skipping.")
            continue
        log(f"[OK] Compiled ENF: {out_path}")

def export_and_quantize(cfg_path: Path, model: str, onnx: Path, qonnx: Path):
    if not onnx.exists():
        run_cmd(["warboy-vision", "export-onnx", "--config_file", str(cfg_path)])
    else:
        log(f"[SKIP] ONNX exists: {onnx}")
    if not qonnx.exists():
        run_cmd(["warboy-vision", "quantize", "--config_file", str(cfg_path)])
    else:
        log(f"[SKIP] Quantized ONNX exists: {qonnx}")

def main():
    models = read_model_list(MODEL_LIST_FILE)
    log(f"Models to process: {models}")
    for model in models:
        log("=" * 80)
        log(f"PROCESS MODEL: {model}")
        paths = expected_paths_for_model(model)
        enf_files = [paths["enf_1"], paths["enf_4"], paths["enf_8"], paths["enf_16"], paths["enf_32"]]
        if all(p.exists() for p in enf_files):
            log(f"[SKIP] All ENFs already exist for {model}")
            continue
        cfg_path = ensure_cfg_for_model(model)
        if not paths["weight"].exists():
            log(f"[WARN] Missing weight: {paths['weight']}")
            continue
        export_and_quantize(cfg_path, model, paths["onnx"], paths["qonnx"])
        compile_enf_for_model(model, paths["qonnx"])
    log("All done.")

if __name__ == "__main__":
    main()
```  

- 아래 명령어를 수행하면, `model-list.yaml`에 기재된 모델에 대해, `../models/enf/object_detections/`에 배치 사이즈별 enf 파일이 생성된다.  

```shell
##-- (venv)
python build_enf_batchsize.py
```

```shell
##-- 실행 결과 예 >
kcloud@k8s-worker2:~/warboy-vision-models_batch_250901/warboy-vision-models$ cat model-list.yaml
model_list:
  - yolov8n
  - yolov8l
  - yolov9t
  - yolov9c

kcloud@k8s-worker2:~/warboy-vision-models_batch_250901$ ls models/enf/object_detection/
yolov8l_4b.enf  yolov8n_16b.enf  yolov8n_4b.enf  yolov8n.enf     yolov9c_8b.enf  yolov9s_16b.enf  yolov9s_8b.enf  yolov9t_16b.enf  yolov9t_4b.enf  yolov9t.enf
yolov8l.enf     yolov8n_32b.enf  yolov8n_8b.enf  yolov9c_4b.enf  yolov9c.enf     yolov9s_4b.enf   yolov9s.enf     yolov9t_32b.enf  yolov9t_8b.enf
```

📗 배치사이즈, 모델별 성능 측정

`run_performance_suite.py`  

- `../models/enf/object_detection` 디렉토리 내, `enf`파일을 기준으로 한다.  
    - 아래와 같으면, yolov8l, yolov9 모델에 대해 batch_size = [1, 4, 8]에 대해 평가를 수행한다.  

```shell
kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ ls ../models/enf/object_detection/
yolov8l_4b.enf  yolov8l.enf yolov9c_4b.enf  yolov9c_8b.enf
```  

```python
#!/usr/bin/env python3
"""
Run warboy-vision model-performance for available ENF batch sizes per model,
log results, print progress to console, and optionally run detached.

- Detects models by scanning ../models/enf/object_detection/*.enf
- Always uses tutorials/cfg/<base>.yaml
- Runs: warboy-vision model-performance --config_file tutorials/cfg/<base>.yaml --batch-size <bs>
- Captures JSON + parses extra metrics (mAP, thresholds, inference sec)
- Summarizes results in Markdown tables
"""

from __future__ import annotations
import argparse, json, os, re, subprocess, sys, time, itertools, threading
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import yaml

# -----------------------------
# Constants
# -----------------------------
REPO_ROOT = Path.cwd()
CFG_DIR = REPO_ROOT / "tutorials" / "cfg"
ENF_DIR = REPO_ROOT / ".." / "models" / "enf" / "object_detection"

# 실행 시점 기반 로그 파일명
START_TS = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_DIR = REPO_ROOT / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

FULL_LOG_FILE = LOG_DIR / f"performance_full_{START_TS}.log"   # 전체 로그
RESULT_LOG_FILE = LOG_DIR / f"performance_result_{START_TS}.log"  # 요약 로그

BATCH_MAP = {
    1: "{model}.enf",
    4: "{model}_4b.enf",
    8: "{model}_8b.enf",
    16: "{model}_16b.enf",
    32: "{model}_32b.enf",
}

# -----------------------------
# Metrics
# -----------------------------
TRANSPOSED_METRICS = [
    #("e2e_wall_per_image", "e2e_wall (img/s)"),
    ("e2e_active", "e2e_active (img/s)"),
    ("infer_only", "infer_only (img/s)"),
    ("lat_pre", "lat_pre (ms)"),
    ("lat_infer", "lat_infer (ms)"),
    ("lat_post", "lat_post (ms)"),
    ("mAP", "mAP"),
    ("Target", "Target"),
    ("Status", "Status"),
    ("sec", "sec (s)"),
]


# -----------------------------
# Logging helpers
# -----------------------------
def log_line(msg: str, both: bool = True):
    if msg == "":  # 빈 문자열이면 그냥 개행
        if both:
            print("", flush=True)
        try:
            with FULL_LOG_FILE.open("a", encoding="utf-8") as f:
                f.write("\n")
        except Exception:
            pass
        return

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    if both:
        print(line, flush=True)
    try:
        with FULL_LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# -----------------------------
# Utilities
# -----------------------------
def base_model_name(model: str) -> str:
    return re.sub(r"_\d+b$", "", model)

def discover_models_from_enf(enf_dir: Path) -> list[str]:
    models = set()
    for enf in enf_dir.glob("*.enf"):
        models.add(base_model_name(enf.stem))
    return sorted(models)

def available_batches_for_model(model: str) -> List[int]:
    bs_list: List[int] = []
    for bs, pat in BATCH_MAP.items():
        enf_path = ENF_DIR / pat.format(model=model)
        if enf_path.exists():
            bs_list.append(bs)
    return sorted(bs_list)

def get_e2e_wall_imgps(res: dict) -> Optional[float]:
    """
    Return per-image wall throughput (img/s) computed by runner.
    """
    comp = res.get("computed", {})
    return comp.get("e2e_wall_per_image") or res.get("throughput_img_per_s", {}).get("e2e_wall_per_image")

def run_cmd_stream(cmd: List[str]) -> Tuple[int, List[str], bool]:
    log_line(f"RUN: {' '.join(cmd)}")

    lines: List[str] = []
    panic_detected = False
    oom_detected = False
    with FULL_LOG_FILE.open("a", encoding="utf-8") as f:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=str(REPO_ROOT),
        )
        assert proc.stdout is not None
        for line in proc.stdout:
            sys.stdout.write(line)
            f.write(line)
            lines.append(line)

            if "Not enough memory" in line:
                oom_detected = True
                log_line(f"[OOM DETECTED] {line.strip()}")
                try: proc.kill()
                except Exception: pass
                break
            if "panicked at" in line:
                panic_detected = True
                log_line(f"[PANIC DETECTED] {line.strip()}")
                try: proc.kill()
                except Exception: pass
                break
        proc.wait(timeout=5)
        rc = proc.returncode
    if panic_detected:
        rc = rc or 99
    return rc, lines, oom_detected


def extract_result_json(lines: List[str]) -> Optional[dict]:
    text = "".join(lines)
    candidates: List[str] = []
    stack = 0; start_idx = None
    for i, ch in enumerate(text):
        if ch == '{':
            if stack == 0: start_idx = i
            stack += 1
        elif ch == '}':
            if stack > 0:
                stack -= 1
                if stack == 0 and start_idx is not None:
                    candidates.append(text[start_idx:i+1]); start_idx = None
    for snippet in reversed(candidates):
        try: obj = json.loads(snippet)
        except Exception: continue
        if isinstance(obj, dict) and "throughput_img_per_s" in obj:
            return obj
    return None

# -----------------------------
# Cfg file generator
# -----------------------------
COCO_CLASSES = [ "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat",
 "traffic light","fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse",
 "sheep","cow","elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase",
 "frisbee","skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard",
 "surfboard","tennis racket","bottle","wine glass","cup","fork","knife","spoon","bowl","banana",
 "apple","sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair","couch",
 "potted plant","bed","dining table","toilet","tv","laptop","mouse","remote","keyboard","cell phone",
 "microwave","oven","toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear",
 "hair drier","toothbrush" ]

def ensure_cfg_yaml(model: str, cfg_dir: Path):
    cfg_path = cfg_dir / f"{model}.yaml"
    if cfg_path.exists(): return cfg_path
    cfg = {
        "task": "object_detection",
        "model_name": model,
        "weight": f"../models/weight/object_detection/{model}.pt",
        "onnx_path": f"../models/onnx/object_detection/{model}.onnx",
        "onnx_i8_path": f"../models/quantized_onnx/object_detection/{model}_i8.onnx",
        "calibration_params": {
            "calibration_method": "SQNR_ASYM",
            "calibration_data": "../datasets/coco/val2017",
            "num_calibration_data": 100,
        },
        "conf_thres": 0.025,
        "iou_thres": 0.7,
        "input_shape": [1, 3, 640, 640],
        "anchors": [None],
        "class_names": COCO_CLASSES,
    }
    cfg_dir.mkdir(parents=True, exist_ok=True)
    with cfg_path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, sort_keys=False, allow_unicode=True)
    log_line(f"[AUTO] Created config: {cfg_path}")
    return cfg_path

# -----------------------------
# Suite Runner
# -----------------------------
def run_one(model: str, batch_size: int, save_samples: int, sample_start: int) -> Optional[dict]:
    base = base_model_name(model)
    cfg_path = ensure_cfg_yaml(base, CFG_DIR)

    retries = 3
    #for attempt in range(retries):
    #    rc, lines, oom = run_cmd_stream([
    #        "warboy-vision","model-performance",
    #        "--config_file",str(cfg_path),"--batch-size",str(batch_size)
    #    ])
    for attempt in range(retries):
        cmd = [
            "warboy-vision","model-performance",
            "--config_file",str(cfg_path),
            "--batch-size",str(batch_size),
        ]
        # sample 저장 옵션 처리
        if save_samples > 0:
            cmd += ["--save-samples", str(save_samples)]
            if sample_start:
                cmd += ["--sample-start", str(sample_start)]
        rc, lines, oom = run_cmd_stream(cmd)

        if oom:
            try:
                subprocess.run(["pkill", "-f", "warboy-vision model-performance"], check=False)
                log_line(f"[CLEANUP] OOM occurred, killed leftover processes for {model} bs={batch_size}")
            except Exception as e:
                log_line(f"[CLEANUP ERROR] {e}")
            return None 

        if rc == 0:
            break
        log_line(f"[WARN] Attempt {attempt+1}/{retries} failed (rc={rc})")

    if rc != 0:
        log_line(f"[ERROR] model-performance failed after {retries} attempts for {model} bs={batch_size}")
        return None
      
    result = extract_result_json(lines)
    if result is None:
        log_line(f"[WARN] JSON result not found for {model} bs={batch_size}")
        return None
    
    # parse extra metrics
    conf_thres = iou_thres = sec = mAP = target = None
    status = None
    for line in lines:
        m1 = re.match(r"^([0-9.]+)\s+([0-9.]+)", line.strip())
        if m1:
            conf_thres, iou_thres = float(m1.group(1)), float(m1.group(2))
        m2 = re.search(r"Inference Done in ([0-9.]+) sec", line)
        if m2:
            sec = float(m2.group(1))
        m3 = re.search(r"Accuracy check (success|failed)! -> mAP: ([0-9.]+) \[Target: ([0-9.]+)\]", line)
        if m3:
            status = m3.group(1)
            mAP = float(m3.group(2))
            target = float(m3.group(3))

    # store parsed + computed
    result["metrics"] = {
        "conf_thres": conf_thres,
        "iou_thres": iou_thres,
        "sec": sec,
        "mAP": mAP,
        "target": target,
        "status": status,
    }
    
    #e2e_wall_imgps = result.get("throughput_img_per_s", {}).get("e2e_wall_per_image")
    #result.setdefault("computed", {})["e2e_wall_per_image"] = e2e_wall_imgps

    thr = result.get("throughput_img_per_s", {})
    lat = result.get("latency_ms", {})
    log_line("")
    log_line(
        "RESULT "
        f"{model} bs={batch_size} | "
        #f"e2e_wall_imgps={e2e_wall_imgps} e2e_active={thr.get('e2e_active')} infer_only={thr.get('infer_only')} | "
        f"e2e_active={thr.get('e2e_active')} infer_only={thr.get('infer_only')} | "
        f"lat_pre_avg={(lat.get('pre',{}) or {}).get('avg')} lat_infer_avg={(lat.get('infer',{}) or {}).get('avg')} "
        f"lat_post_avg={(lat.get('post',{}) or {}).get('avg')} | "
        f"mAP={mAP} target={target} status={status} | conf={conf_thres} iou={iou_thres} sec={sec}"
    )
    log_line("")
    return result


def summarize_by_batch(all_results: Dict[str, Dict[int, dict]], batch_size: int) -> str:
    def fmt(x): 
        return "NA" if x is None else f"{x:.3f}"
    
    conf_val, iou_val = "NA", "NA"
    for bs_dict in all_results.values():
        if batch_size in bs_dict:
            conf_val, iou_val = get_conf_iou(bs_dict[batch_size])
            break

    header = f"[batch_size : {batch_size}] : conf ({conf_val}), iou ({iou_val})"
    table = [
        #"| model | e2e_wall_per_image (img/s) | e2e_active (img/s) | infer_only (img/s) | "
        "| model | e2e_active (img/s) | infer_only (img/s) | "
        "lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |",
        #"|-------|-----------------------------|--------------------|--------------------|"
        "|-------|--------------------|--------------------|"
        "----------------|-----------------|----------------|-----|--------|--------|---------|",
    ]

    for model, by_bs in all_results.items():
        if batch_size not in by_bs:
            continue
        res = by_bs[batch_size]
        thr = res.get("throughput_img_per_s", {})
        lat = res.get("latency_ms", {})
        m = res.get("metrics", {})
        comp = res.get("computed", {})
        row = (
            #f"| {model} | {fmt(comp.get('e2e_wall_per_image'))} | "
            f"| {model} | "
            f"{fmt(thr.get('e2e_active'))} | {fmt(thr.get('infer_only'))} | "
            f"{fmt((lat.get('pre',{}) or {}).get('avg'))} | "
            f"{fmt((lat.get('infer',{}) or {}).get('avg'))} | "
            f"{fmt((lat.get('post',{}) or {}).get('avg'))} | "
            f"{fmt(m.get('mAP'))} | {fmt(m.get('target'))} | {m.get('status') or 'NA'} | "
            f"{fmt(m.get('sec'))} |"
        )
        table.append(row)

    return "\n".join([header, ""] + table + [""])


def summarize_by_model(model: str, by_bs: Dict[int, dict]) -> str:
    if not by_bs:
        return f"[model : {model}] (no results)\n"
    def fmt(x): 
        return "NA" if x is None else f"{x:.3f}"
    
    first_metrics = next(iter(by_bs.values())).get("metrics", {})
    conf_val = fmt(first_metrics.get("conf_thres"))
    iou_val = fmt(first_metrics.get("iou_thres"))

    header = f"[model : {model}] : conf ({conf_val}), iou ({iou_val})"
    table = [
        #"| batch_size | e2e_wall_per_image (img/s) | e2e_active (img/s) | infer_only (img/s) | "
        "| batch_size | e2e_active (img/s) | infer_only (img/s) | "
        "lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |",
        #"|------------|-----------------------------|--------------------|--------------------|"
        "|------------|--------------------|--------------------|"
        "----------------|-----------------|----------------|-----|--------|--------|---------|",
    ]
    for bs in sorted(by_bs.keys()):
        res = by_bs[bs]
        thr = res.get("throughput_img_per_s", {})
        lat = res.get("latency_ms", {})
        metrics = res.get("metrics", {})
        comp = res.get("computed", {})
        row = (
            #f"| {bs} | {fmt(comp.get('e2e_wall_per_image'))} | "
            f"| {bs} | "
            f"{fmt(thr.get('e2e_active'))} | {fmt(thr.get('infer_only'))} | "
            f"{fmt((lat.get('pre',{}) or {}).get('avg'))} | "
            f"{fmt((lat.get('infer',{}) or {}).get('avg'))} | "
            f"{fmt((lat.get('post',{}) or {}).get('avg'))} | "
            f"{fmt(metrics.get('mAP'))} | {fmt(metrics.get('target'))} | {metrics.get('status') or 'NA'} | "
            f"{fmt(metrics.get('sec'))} |"
        )
        table.append(row)
    return "\n".join([header, ""] + table + [""])

def get_conf_iou(from_res: dict) -> tuple[str, str]:
    """metrics 블록에서 conf/iou 문자열 반환"""
    def fmt(x): return "NA" if x is None else f"{x:.3f}"
    m = from_res.get("metrics", {}) if from_res else {}
    return fmt(m.get("conf_thres")), fmt(m.get("iou_thres"))

def extract_metric_value(res: dict, metric: str):
    """metric 이름별 값 추출"""
    thr, lat, m, comp = (
        res.get("throughput_img_per_s", {}),
        res.get("latency_ms", {}),
        res.get("metrics", {}),
        res.get("computed", {}),
    )
    #if metric == "e2e_wall_per_image":
    #    return comp.get("e2e_wall_per_image")
    #elif metric == "e2e_active":
    if metric == "e2e_active":
        return thr.get("e2e_active")
    elif metric == "infer_only":
        return thr.get("infer_only")
    elif metric == "lat_pre":
        return (lat.get("pre", {}) or {}).get("avg")
    elif metric == "lat_infer":
        return (lat.get("infer", {}) or {}).get("avg")
    elif metric == "lat_post":
        return (lat.get("post", {}) or {}).get("avg")
    elif metric == "mAP":
        return m.get("mAP")
    elif metric == "Target":
        return m.get("target")
    elif metric == "Status":
        return m.get("status")
    elif metric == "conf":
        return m.get("conf_thres")
    elif metric == "iou":
        return m.get("iou_thres")
    elif metric == "sec":
        return m.get("sec")
    return None

def summarize_transposed_by_batch(all_results: Dict[str, Dict[int, dict]], batch_size: int) -> str:
    """
    Transposed summary: 행(metric), 열(models)
    """
    def fmt(x): return "NA" if x is None else f"{x:.3f}"
    models = list(all_results.keys())

    conf_val, iou_val = "NA", "NA"
    for bs_dict in all_results.values():
        if batch_size in bs_dict:
            conf_val, iou_val = get_conf_iou(bs_dict[batch_size])
            break

    rows = []
    for metric, label in TRANSPOSED_METRICS:
        row = [label]
        for model in models:
            res = all_results[model].get(batch_size)
            if not res:
                row.append("NA")
                continue
            val = extract_metric_value(res, metric)
            row.append(fmt(val) if metric != "Status" else (val or "NA"))
        rows.append("| " + " | ".join(row) + " |")

    header = ["models"] + models
    table = [
        f"[transposed summary: batch_size={batch_size}, conf ({conf_val}), iou ({iou_val})]",
        "",
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ] + rows
    return "\n".join(table) + "\n"

def summarize_transposed_by_model(model: str, by_bs: Dict[int, dict]) -> str:
    """
    Transposed summary: 행(metric), 열(batch sizes)
    """
    def fmt(x): return "NA" if x is None else f"{x:.3f}"
    batch_sizes = sorted(by_bs.keys())

    # conf/iou는 첫 배치 결과에서 가져오기
    first_res = next(iter(by_bs.values()))
    conf_val, iou_val = get_conf_iou(first_res)

    rows = []
    for metric, label in TRANSPOSED_METRICS:
        row = [label]
        for bs in batch_sizes:
            res = by_bs[bs]
            val = extract_metric_value(res, metric)
            row.append(fmt(val) if metric != "Status" else (val or "NA"))
        rows.append("| " + " | ".join(row) + " |")

    header = ["batch_size"] + [str(bs) for bs in batch_sizes]
    table = [
        f"[transposed summary: model={model}, conf ({conf_val}), iou ({iou_val})]",
        "",
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ] + rows
    return "\n".join(table) + "\n"

# -----------------------------
# Main
# -----------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--save-samples", type=int, default=0,
                        help="Save N sample images per model to outputs/(model_bs)/ (0=disable).")
    parser.add_argument("--sample-start", type=int, default=None,
                        help="Starting dataset index (1-based) for saving samples. "
                             "Valid only if --save-samples > 0")
    args = parser.parse_args()
    delay = 5
    
    log_line("="*80)
    log_line(f"===== Run started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} =====")
    log_line(f"Full log file: {FULL_LOG_FILE}")
    log_line(f"Result log file: {RESULT_LOG_FILE}")
    log_line("="*80)

    try:
        subprocess.run(["pkill", "-f", "warboy-vision model-performance"], check=False)
        log_line("[CLEANUP] Killed leftover 'warboy-vision model-performance' processes")
    except Exception as e:
        log_line(f"[CLEANUP ERROR] {e}")

    time.sleep(delay)

    models = discover_models_from_enf(ENF_DIR)
    log_line(f"Models to process: {models}")
    all_results: Dict[str, Dict[int, dict]] = {}

    for model in models:
        log_line("="*80)
        log_line(f"PROCESS MODEL: {model}")
        batches = available_batches_for_model(model)
        if not batches:
            log_line(f"[WARN] No ENF found for {model}")
            continue

        log_line(f"Available batches: {batches}")
        model_results: Dict[int, dict] = {}

        for bs in batches:
            res = run_one(model, bs,
                          save_samples=args.save_samples,
                          sample_start=(args.sample_start if args.save_samples > 0 else None))
            if res:
                model_results[bs] = res

        all_results[model] = model_results

        # 모델별 요약 저장
        if model_results:
            summary = summarize_by_model(model, model_results)
            log_line("\n" + summary)  # full 로그에 기록
            with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                rf.write(summary + "\n\n")  # result 로그에 따로 저장

            summary_t = summarize_transposed_by_model(model, model_results)
            log_line("\n" + summary_t)
            with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                rf.write(summary_t + "\n\n")

    # 배치 사이즈별 요약 (full 로그에만 기록)
    batch_sizes_present = sorted({bs for m in all_results.values() for bs in m.keys()})
    for bs in batch_sizes_present:
        summary = summarize_by_batch(all_results, bs)
        log_line("\n" + summary)
        with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
            rf.write(summary + "\n\n")

        summary_t = summarize_transposed_by_batch(all_results, bs)
        log_line("\n" + summary_t)
        with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
            rf.write(summary_t + "\n\n")

    log_line("All done.")


if __name__=="__main__":
    try: main()
    except KeyboardInterrupt: log_line("Interrupted by user."); raise
```   



```shell
##-- (venv)
python run_performance_suite.py
```  


```shell
##-- 실행 결과 예 >
[2025-09-08 13:55:43] ================================================================================
[2025-09-08 13:55:43] ===== Run started at 2025-09-08 13:55:43 =====
[2025-09-08 13:55:43] Full log file: /home/kcloud/warboy-vision-models/warboy-vision-models/performance_full_20250908_135543.log
[2025-09-08 13:55:43] Result log file: /home/kcloud/warboy-vision-models/warboy-vision-models/performance_result_20250908_135543.log
[2025-09-08 13:55:43] ================================================================================
[2025-09-08 13:55:43] [CLEANUP] Killed leftover 'warboy-vision model-performance' processes
[2025-09-08 13:55:48] Models to process: ['yolov8l', 'yolov8n', 'yolov9c', 'yolov9t']
[2025-09-08 13:55:48] ================================================================================
[2025-09-08 13:55:48] PROCESS MODEL: yolov8l
[2025-09-08 13:55:48] Available batches: [1]
[2025-09-08 13:55:48] RUN: warboy-vision model-performance --config_file /home/kcloud/warboy-vision-models/warboy-vision-models/tutorials/cfg/yolov8l.yaml --batch-size 1
loading annotations into memory...
Done (t=0.41s)
creating index...
index created!
[Pipeline.add] Engine registered: {
  "model": "../models/enf/object_detection/yolov8l.enf",
  "worker_num": 16,
  "device": "warboy(1)*1",
  "batch_size": 1,
  "conf_thres": 0.025,
  "iou_thres": 0.7
}
0.025 0.7 [None] False
[WarboyApplication] Loading precompiled ENF: ../models/enf/object_detection/yolov8l.enf
WarboyApplication - init
[2m2025-09-08T04:55:50.795641Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
[2m2025-09-08T04:55:50.803043Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
[2m2025-09-08T04:55:50.803058Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
[2m2025-09-08T04:55:50.803072Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] detected 1 NPU device(s):
[2m2025-09-08T04:55:50.831080Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m - [0] npu:0:0 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
[2m2025-09-08T04:55:50.831291Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] started
[2m2025-09-08T04:55:50.833805Z[0m [32m INFO[0m [2mfuriosa::runtime[0m[2m:[0m Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250908135550-x2vc4p.log
[2m2025-09-08T04:55:50.890951Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] created Sess-529089e1 using npu:0:0
[2m2025-09-08T04:55:50.921140Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Sess-529089e1] compiling the model (target: warboy-b0, 64dpes, file: yolov8l.enf, size: 70.6 MiB)
[2m2025-09-08T04:55:53.350636Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Sess-529089e1] the model compile is successful (took 2 secs)
[2m2025-09-08T04:55:53.733127Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] created 16 NPU threads on npu:0:0 (DRAM: 1.6 GiB/16.0 GiB, SRAM: 16.0 MiB/64.0 MiB)
[Decoder] 0 pre=2.864 ms
[Decoder] 1 pre=1.921 ms
[Decoder] 2 pre=0.857 ms
[Decoder] 3 pre=1.152 ms
[Decoder] 4 pre=7.194 ms
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 0 infer=41.246 ms
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 1 infer=39.388 ms
[Runtime] 2 infer=39.999 ms
[Runtime] 3 infer=36.831 ms
[Runtime] 4 infer=34.685 ms
[Encoder] 0 post=172.861 ms e2e_active=216.971 ms e2e_wall=4072.333 ms
[Encoder] 1 post=23.564 ms e2e_active=64.873 ms e2e_wall=3909.049 ms
[Encoder] 2 post=4.750 ms e2e_active=45.607 ms e2e_wall=3915.315 ms
[Encoder] 3 post=4.022 ms e2e_active=42.005 ms e2e_wall=3916.518 ms
[Encoder] 4 post=4.035 ms e2e_active=45.915 ms e2e_wall=3921.974 ms
Inference Done in 202.52 sec
{
  "model": "yolov8l",
  "cfg": "yolov8l.yaml",
  "images": 5000,
  "throughput_img_per_s": {
    "e2e_active": 22.69904703079691,
    "infer_only": 29.091889872078784,
    "e2e_wall_per_image": 0.052210931520178895
  },
  "latency_ms": {
    "pre": {
      "avg": 1.326445949796471,
      "p50": 1.2082029998055077
    },
    "infer": {
      "avg": 34.37384110819694,
      "p50": 34.19404900068912
    },
    "post": {
      "avg": 8.35442584000848,
      "p50": 8.339865000380087
    },
    "e2e_active": {
      "avg": 44.05471289800189,
      "p50": 43.955218001428875
    },
    "e2e_wall": {
      "avg": 19153.07715997199,
      "p50": 19863.32442299954
    }
  },
  "dataset_img_per_s": {
    "throughput_wall": 24.68934862594473
  }
}
Loading and preparing results...
DONE (t=0.29s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=16.57s).
Accumulating evaluation results...
DONE (t=2.65s).
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.495
 Average Precision  (AP) @[ IoU=0.50      | area=   all | maxDets=100 ] = 0.659
 Average Precision  (AP) @[ IoU=0.75      | area=   all | maxDets=100 ] = 0.538
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.316
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.554
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.658
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=  1 ] = 0.368
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets= 10 ] = 0.586
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.613
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.426
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.675
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.764
yolov8l Accuracy check success! -> mAP: 0.4950743174982471 [Target: 0.4761]

[2025-09-08 13:59:42] RESULT yolov8l bs=1 | e2e_wall_imgps=0.052210931520178895 e2e_active=22.69904703079691 infer_only=29.091889872078784 | lat_pre_avg=1.326445949796471 lat_infer_avg=34.37384110819694 lat_post_avg=8.35442584000848 | mAP=0.4950743174982471 target=0.4761 status=success | conf=0.025 iou=0.7 sec=202.52

[2025-09-08 13:59:42] 
[model : yolov8l] : conf (0.025), iou (0.700)

| batch_size | e2e_wall_per_image (img/s) | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|-----------------------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 0.052 | 22.699 | 29.092 | 1.326 | 34.374 | 8.354 | 0.495 | 0.476 | success | 202.520 |

[2025-09-08 13:59:42] 
[transposed summary: model=yolov8l, conf (0.025), iou (0.700)]

| batch_size | 1 |
| --- | --- |
| e2e_wall_per_image | 0.052 |
| e2e_active | 22.699 |
| infer_only | 29.092 |
| lat_pre | 1.326 |
| lat_infer | 34.374 |
| lat_post | 8.354 |
| mAP | 0.495 |
| Target | 0.476 |
| Status | success |
| sec | 202.520 |

[2025-09-08 13:59:42] ================================================================================
[2025-09-08 13:59:42] PROCESS MODEL: yolov8n
[2025-09-08 13:59:42] Available batches: [1, 4, 8, 16, 32]
[2025-09-08 13:59:42] RUN: warboy-vision model-performance --config_file /home/kcloud/warboy-vision-models/warboy-vision-models/tutorials/cfg/yolov8n.yaml --batch-size 1
loading annotations into memory...
Done (t=0.41s)
creating index...
index created!
[Pipeline.add] Engine registered: {
  "model": "../models/enf/object_detection/yolov8n.enf",
  "worker_num": 16,
  "device": "warboy(1)*1",
  "batch_size": 1,
  "conf_thres": 0.025,
  "iou_thres": 0.7
}
0.025 0.7 [None] False
[WarboyApplication] Loading precompiled ENF: ../models/enf/object_detection/yolov8n.enf
WarboyApplication - init
[2m2025-09-08T04:59:44.514950Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
[2m2025-09-08T04:59:44.520090Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
[2m2025-09-08T04:59:44.520107Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
[2m2025-09-08T04:59:44.520115Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] detected 1 NPU device(s):
[2m2025-09-08T04:59:44.549438Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m - [0] npu:0:0 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
[2m2025-09-08T04:59:44.549660Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] started
[2m2025-09-08T04:59:44.552211Z[0m [32m INFO[0m [2mfuriosa::runtime[0m[2m:[0m Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250908135944-xhhdtj.log
[2m2025-09-08T04:59:44.565435Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] created Sess-6d292fb4 using npu:0:0
[2m2025-09-08T04:59:44.589663Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Sess-6d292fb4] compiling the model (target: warboy-b0, 64dpes, file: yolov8n.enf, size: 11.4 MiB)
[2m2025-09-08T04:59:44.997097Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Sess-6d292fb4] the model compile is successful (took 0 secs)
[2m2025-09-08T04:59:45.049043Z[0m [32m INFO[0m [2mfuriosa_rt_core::driver::event_driven::coord[0m[2m:[0m [Runtime-0] created 16 NPU threads on npu:0:0 (DRAM: 42.7 MiB/16.0 GiB, SRAM: 11.3 MiB/64.0 MiB)
[Decoder] 0 pre=2.882 ms
[Decoder] 1 pre=2.664 ms
[Decoder] 2 pre=1.135 ms
[Decoder] 3 pre=1.336 ms
[Decoder] 4 pre=7.569 ms
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 0 infer=15.259 ms
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 1 infer=14.571 ms
[Runtime] 2 infer=15.454 ms
[Runtime] 3 infer=15.144 ms
[Runtime] 4 infer=13.468 ms
[Encoder] 0 post=180.060 ms e2e_active=198.201 ms e2e_wall=1021.237 ms
[Encoder] 1 post=26.111 ms e2e_active=43.346 ms e2e_wall=861.654 ms
[Encoder] 2 post=5.389 ms e2e_active=21.978 ms e2e_wall=868.087 ms
[Encoder] 3 post=4.227 ms e2e_active=20.707 ms e2e_wall=868.876 ms
[Encoder] 4 post=4.104 ms e2e_active=25.141 ms e2e_wall=874.499 ms
Inference Done in 80.73 sec
{
  "model": "yolov8n",
  "cfg": "yolov8n.yaml",
  "images": 5000,
  "throughput_img_per_s": {
    "e2e_active": 59.5844739464847,
    "infer_only": 92.46688235059459,
    "e2e_wall_per_image": 0.1340024800666283
  },
  "latency_ms": {
    "pre": {
      "avg": 1.317460934603514,
      "p50": 1.217676499436493
    },
    "infer": {
      "avg": 10.814682777001508,
      "p50": 10.672086999875319
    },
    "post": {
      "avg": 4.6507517939950045,
      "p50": 4.555833999802417
    },
    "e2e_active": {
      "avg": 16.782895505600028,
      "p50": 16.55319849942316
    },
    "e2e_wall": {
      "avg": 7462.5484506166085,
      "p50": 7960.200120999616
    }
  },
  "dataset_img_per_s": {
    "throughput_wall": 61.93658936757913
  }
}
Loading and preparing results...
DONE (t=0.35s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=19.53s).
Accumulating evaluation results...
DONE (t=2.92s).
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.345
 Average Precision  (AP) @[ IoU=0.50      | area=   all | maxDets=100 ] = 0.488
 Average Precision  (AP) @[ IoU=0.75      | area=   all | maxDets=100 ] = 0.376
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.155
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.385
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.501
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=  1 ] = 0.281
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets= 10 ] = 0.441
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.467
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.233
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.517
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.636
yolov8n Accuracy check success! -> mAP: 0.345059530554652 [Target: 0.3357]

[2025-09-08 14:01:40] RESULT yolov8n bs=1 | e2e_wall_imgps=0.1340024800666283 e2e_active=59.5844739464847 infer_only=92.46688235059459 | lat_pre_avg=1.317460934603514 lat_infer_avg=10.814682777001508 lat_post_avg=4.6507517939950045 | mAP=0.345059530554652 target=0.3357 status=success | conf=0.025 iou=0.7 sec=80.73
```   

### 배치사이즈별 시혐 지표 및 결과

- e2e_wall_per_image (imgs/s)  
    - **이미지 당** 엔드-투-엔드(Pre+Infer+Post) 처리량으로 값이 클수록 좋다.  
    - `img/s = 1000 / (엔드-투-엔드 평균 지연(ms))`  
    - 여기에서는 5,000 장의 이미지 수행 총 시간에 따른 이미지 당 처리율을 말한다.  
- e2e_active (imgs/s)  
    - 장치가 실제로 작업 중(active) 이었을 때,기준의 엔드-투-엔드(Pre+Infer+Post) 처리량으로 값이 클수록 좋다.  
    - e2e_wall_per_image와 달리 `대기시간`을 제외하여 계산한다.    
- infer_only (imgs/s)  
    - **추론(inference) 단계** 만의 per-image 처리량. Pre/NMS 등은 제외. 값이 클수록 좋다.  
- lat_pre (ms)  
    - **한 이미지**에 대한 **전처리(Preprocess)**에 걸린 평균 시간  
- lat_infer (ms)  
    - **한 이미지**에 대한 **추론(Infer)**에 걸린 평균 시간  
- lat_post (ms)  
    - **한 이미지**에 대한 **후처리(Post/NMS)**에 걸린 평균 시간  
    - `img/s = 1000 / (엔드-투-엔드 평균 지연(ms))`  
- mAP  
    - 추론 정확도  
    - COCO-style mAP@0.50:0.95 (0~1 사이, 클수록 정확도가 높음)  
- sec (s)  
    - 전체 실행의 경과 시간(5,000장)  
    - 한 모델, 배치조합에 대한 벤치마크, 정확도 검증까지 포함한 총 시간  


📗 yolov8n, yolov8l, yolov9t, yolov9c 의 배치사이즈 [1, 4, 8, 16, 32] 수행 결과  

- **coco dataset, val2017 (5,000장), object_detection**

[model : yolov8l] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 22.445 | 29.109 | 1.751 | 34.354 | 8.448 | 0.495 | 0.476 | success | 203.150 |


[transposed summary: model=yolov8l, conf (0.025), iou (0.700)]

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 22.445 |
| infer_only (img/s) | 29.109 |
| lat_pre (ms) | 1.751 |
| lat_infer (ms) | 34.354 |
| lat_post (ms) | 8.448 |
| mAP | 0.495 |
| Target | 0.476 |
| Status | success |
| sec (s) | 203.150 |


[model : yolov8n] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 58.721 | 92.283 | 1.353 | 10.836 | 4.841 | 0.345 | 0.336 | success | 81.390 |
| 4 | 65.203 | 105.369 | 1.192 | 9.490 | 4.654 | 0.345 | 0.336 | success | 69.880 |
| 8 | 55.331 | 82.802 | 1.154 | 12.077 | 4.842 | 0.345 | 0.336 | success | 81.720 |
| 16 | 62.415 | 97.159 | 1.129 | 10.292 | 4.600 | 0.345 | 0.336 | success | 71.010 |


[transposed summary: model=yolov8n, conf (0.025), iou (0.700)]

| batch_size | 1 | 4 | 8 | 16 |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 58.721 | 65.203 | 55.331 | 62.415 |
| infer_only (img/s) | 92.283 | 105.369 | 82.802 | 97.159 |
| lat_pre (ms) | 1.353 | 1.192 | 1.154 | 1.129 |
| lat_infer (ms) | 10.836 | 9.490 | 12.077 | 10.292 |
| lat_post (ms) | 4.841 | 4.654 | 4.842 | 4.600 |
| mAP | 0.345 | 0.345 | 0.345 | 0.345 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success |
| sec (s) | 81.390 | 69.880 | 81.720 | 71.010 |


[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 27.940 | 39.006 | 1.758 | 25.637 | 8.395 | 0.497 | 0.477 | success | 157.680 |


[transposed summary: model=yolov9c, conf (0.025), iou (0.700)]

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 27.940 |
| infer_only (img/s) | 39.006 |
| lat_pre (ms) | 1.758 |
| lat_infer (ms) | 25.637 |
| lat_post (ms) | 8.395 |
| mAP | 0.497 |
| Target | 0.477 |
| Status | success |
| sec (s) | 157.680 |


[model : yolov9t] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 55.373 | 85.593 | 1.422 | 11.683 | 4.954 | 0.349 | 0.345 | success | 85.620 |
| 4 | 65.452 | 105.649 | 1.196 | 9.465 | 4.617 | 0.349 | 0.345 | success | 69.950 |
| 8 | 54.953 | 82.072 | 1.160 | 12.184 | 4.853 | 0.349 | 0.345 | success | 82.550 |


[transposed summary: model=yolov9t, conf (0.025), iou (0.700)]

| batch_size | 1 | 4 | 8 |
| --- | --- | --- | --- |
| e2e_active (img/s) | 55.373 | 65.452 | 54.953 |
| infer_only (img/s) | 85.593 | 105.649 | 82.072 |
| lat_pre (ms) | 1.422 | 1.196 | 1.160 |
| lat_infer (ms) | 11.683 | 9.465 | 12.184 |
| lat_post (ms) | 4.954 | 4.617 | 4.853 |
| mAP | 0.349 | 0.349 | 0.349 |
| Target | 0.345 | 0.345 | 0.345 |
| Status | success | success | success |
| sec (s) | 85.620 | 69.950 | 82.550 |


[batch_size : 1] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8l | 22.445 | 29.109 | 1.751 | 34.354 | 8.448 | 0.495 | 0.476 | success | 203.150 |
| yolov8n | 58.721 | 92.283 | 1.353 | 10.836 | 4.841 | 0.345 | 0.336 | success | 81.390 |
| yolov9c | 27.940 | 39.006 | 1.758 | 25.637 | 8.395 | 0.497 | 0.477 | success | 157.680 |
| yolov9t | 55.373 | 85.593 | 1.422 | 11.683 | 4.954 | 0.349 | 0.345 | success | 85.620 |


[transposed summary: batch_size=1, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 22.445 | 58.721 | 27.940 | 55.373 |
| infer_only (img/s) | 29.109 | 92.283 | 39.006 | 85.593 |
| lat_pre (ms) | 1.751 | 1.353 | 1.758 | 1.422 |
| lat_infer (ms) | 34.354 | 10.836 | 25.637 | 11.683 |
| lat_post (ms) | 8.448 | 4.841 | 8.395 | 4.954 |
| mAP | 0.495 | 0.345 | 0.497 | 0.349 |
| Target | 0.476 | 0.336 | 0.477 | 0.345 |
| Status | success | success | success | success |
| sec (s) | 203.150 | 81.390 | 157.680 | 85.620 |


[batch_size : 4] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8n | 65.203 | 105.369 | 1.192 | 9.490 | 4.654 | 0.345 | 0.336 | success | 69.880 |
| yolov9t | 65.452 | 105.649 | 1.196 | 9.465 | 4.617 | 0.349 | 0.345 | success | 69.950 |


[transposed summary: batch_size=4, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 65.203 | NA | 65.452 |
| infer_only (img/s) | NA | 105.369 | NA | 105.649 |
| lat_pre (ms) | NA | 1.192 | NA | 1.196 |
| lat_infer (ms) | NA | 9.490 | NA | 9.465 |
| lat_post (ms) | NA | 4.654 | NA | 4.617 |
| mAP | NA | 0.345 | NA | 0.349 |
| Target | NA | 0.336 | NA | 0.345 |
| Status | NA | success | NA | success |
| sec (s) | NA | 69.880 | NA | 69.950 |


[batch_size : 8] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8n | 55.331 | 82.802 | 1.154 | 12.077 | 4.842 | 0.345 | 0.336 | success | 81.720 |
| yolov9t | 54.953 | 82.072 | 1.160 | 12.184 | 4.853 | 0.349 | 0.345 | success | 82.550 |


[transposed summary: batch_size=8, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 55.331 | NA | 54.953 |
| infer_only (img/s) | NA | 82.802 | NA | 82.072 |
| lat_pre (ms) | NA | 1.154 | NA | 1.160 |
| lat_infer (ms) | NA | 12.077 | NA | 12.184 |
| lat_post (ms) | NA | 4.842 | NA | 4.853 |
| mAP | NA | 0.345 | NA | 0.349 |
| Target | NA | 0.336 | NA | 0.345 |
| Status | NA | success | NA | success |
| sec (s) | NA | 81.720 | NA | 82.550 |


[batch_size : 16] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8n | 62.415 | 97.159 | 1.129 | 10.292 | 4.600 | 0.345 | 0.336 | success | 71.010 |


[transposed summary: batch_size=16, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 62.415 | NA | NA |
| infer_only (img/s) | NA | 97.159 | NA | NA |
| lat_pre (ms) | NA | 1.129 | NA | NA |
| lat_infer (ms) | NA | 10.292 | NA | NA |
| lat_post (ms) | NA | 4.600 | NA | NA |
| mAP | NA | 0.345 | NA | NA |
| Target | NA | 0.336 | NA | NA |
| Status | NA | success | NA | NA |
| sec (s) | NA | 71.010 | NA | NA |





📗 `build_enf_batchsize.py`, `run_performance_suite.py` 코드 수행 없이 수행하려면 아래 절차를 따른다.

- 모델 설정, ONNX 변환, 양자화 수행 후, 배치 사이즈별 컴파일  
    - 컴파일 시, `target-npu` 를 `warboy`로 지정해야 추론 시, slice Error 피할 수 있다.  
    
```shell
cd ~/warboy-vision-models
source venv/bin/activate

##-- (venv) >
cd warboy-vision-models/

furiosa-compiler ../models/quantized_onnx/object_detection/yolov9c_i8.onnx -o ../models/enf/object_detection/yolov9c.enf --target-npu warboy
furiosa-compiler --batch-size 4 ../models/quantized_onnx/object_detection/yolov9c_i8.onnx -o ../models/enf/object_detection/yolov9c_4b.enf --target-npu warboy
furiosa-compiler --batch-size 8 ../models/quantized_onnx/object_detection/yolov9c_i8.onnx -o ../models/enf/object_detection/yolov9c_8b.enf --target-npu warboy
furiosa-compiler --batch-size 16 ../models/quantized_onnx/object_detection/yolov9c_i8.onnx -o ../models/enf/object_detection/yolov9c_16b.enf --target-npu warboy
furiosa-compiler --batch-size 32 ../models/quantized_onnx/object_detection/yolov9c_i8.onnx -o ../models/enf/object_detection/yolov9c_32b.enf --target-npu warboy
```  

- 배치 사이즈별 평가 실행

```shell
warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml --batch-size 1
warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml --batch-size 4
warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml --batch-size 8
warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml --batch-size 16
warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml --batch-size 32
```  

- 실행 예(`--batch-size 32`)

```shell
(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml --batch-size 1
loading annotations into memory...
Done (t=0.44s)
creating index...
index created!
[Pipeline.add] Engine registered: {
  "model": "../models/enf/object_detection/yolov9t.enf",
  "worker_num": 16,
  "device": "warboy(1)*1",
  "batch_size": 1,
  "conf_thres": 0.025,
  "iou_thres": 0.7
}
0.025 0.7 [None] False
[WarboyApplication] Loading precompiled ENF: ../models/enf/object_detection/yolov9t.enf
WarboyApplication - init
[Decoder] 0 pre=2.736 ms
[Decoder] 1 pre=2.177 ms
2025-09-10T05:31:33.121622Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
[Decoder] 2 pre=1.051 ms
2025-09-10T05:31:33.129191Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2025-09-10T05:31:33.129221Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2025-09-10T05:31:33.129244Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
[Decoder] 3 pre=1.275 ms
[Decoder] 4 pre=7.620 ms
2025-09-10T05:31:33.156210Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:1 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
2025-09-10T05:31:33.156419Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2025-09-10T05:31:33.158981Z  INFO furiosa::runtime: Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250910143133-e4ijgs.log
2025-09-10T05:31:33.172865Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-08187e67 using npu:0:1
2025-09-10T05:31:33.196405Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-08187e67] compiling the model (target: warboy-b0, 64dpes, file: yolov9t.enf, size: 11.8 MiB)
2025-09-10T05:31:33.636870Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-08187e67] the model compile is successful (took 0 secs)
2025-09-10T05:31:33.695188Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 16 NPU threads on npu:0:1 (DRAM: 42.7 MiB/16.0 GiB, SRAM: 9.6 MiB/64.0 MiB)
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 0 infer=15.000 ms
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 1 infer=17.964 ms
[Runtime] 2 infer=14.931 ms
[Runtime] 3 infer=16.021 ms
[Runtime] 4 infer=16.934 ms
[Encoder] 0 post=186.578 ms e2e_active=204.314 ms e2e_wall=1074.090 ms
[Encoder] 1 post=27.479 ms e2e_active=47.620 ms e2e_wall=907.665 ms
[Encoder] 2 post=5.056 ms e2e_active=21.037 ms e2e_wall=910.141 ms
[Encoder] 3 post=4.557 ms e2e_active=21.853 ms e2e_wall=911.924 ms
[Encoder] 4 post=4.068 ms e2e_active=28.623 ms e2e_wall=917.718 ms
Inference Done in 83.90 sec
{
  "model": "yolov9t",
  "cfg": "yolov9t.yaml",
  "images": 5000,
  "throughput_img_per_s": {
    "e2e_active": 57.090205216592196,
    "infer_only": 88.1025325989364
  },
  "latency_ms": {
    "pre": {
      "avg": 1.3540510293561965,
      "p50": 1.2597175082191825
    },
    "infer": {
      "avg": 11.350411509192782,
      "p50": 11.176286992849782
    },
    "post": {
      "avg": 4.811676984967198,
      "p50": 4.727440507849678
    },
    "e2e_active": {
      "avg": 17.516139523516177,
      "p50": 17.295641009695828
    },
    "e2e_wall": {
      "avg": 7766.8268581560405,
      "p50": 8272.80407800572
    }
  }
}
Loading and preparing results...
DONE (t=0.53s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=19.03s).
Accumulating evaluation results...
DONE (t=2.90s).
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.349
 Average Precision  (AP) @[ IoU=0.50      | area=   all | maxDets=100 ] = 0.486
 Average Precision  (AP) @[ IoU=0.75      | area=   all | maxDets=100 ] = 0.375
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.156
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.391
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.497
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=  1 ] = 0.285
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets= 10 ] = 0.448
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.472
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.233
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.526
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.629
yolov9t Accuracy check success! -> mAP: 0.34850727268114007 [Target: 0.3447]  
```


## 3.6 NVIDIA (Yolov9)

📗 Waroby 수행 과정과 동일 순서로 구성

1. 데이터/설정  
    - Coco `val2017`의 5,000장 입력, 640x640, conf=0.025, iou=0.7  
    - 동일 모델 활용 (yolov8n, yolov8l, yolov9t, yolov9c)  
2. 정밀도 및 런타임
    - INT8 불가로, FP16, FP32 사용  
    - PyToch  
3. 측정 시점  
    - Warmup: 최소 50~100번 (모델/엔진별)  
    - 측정 루프: 매 이터레이션마다 `torch.cuda.synchronize()` 후, `time.perf_counter()`로 구간 타이밍 측정  
    - `DataLoader` 영향 분리: `infer_only`는 미리 로드한 텐서를 바로 `model()`에 전달  
4. 환경  
    - `touch.backends.cuddn.benchmark = True`: 고정 입력 크기 유지  
    - `num_workers` 최적화  


```shell
mkdir ~/nvidia-yolo
cd ~/nvidia-yolo

##-- 가상 환경
python3 -m venv venv
```

```shell
git clone https://github.com/WongKinYiu/yolov9
cd yolov9

pip install -r requirements.txt

mkdir weights

##-- warboy-vision-model에서 다운로드 받는 경로와 맞추려면, 아래와 같이 수행
##-- yolov8n, yolov8l, yolov9t, yolov9c
wget -P weights/ wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt
wget -P weights/ wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8l.pt
wget -P weights/ wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov9t.pt
wget -P weights/ wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov9c.pt

##-- WongKinYiu Repo.에서 제공되는 pt 파일은 아래와 같이 수행
wget -P weights/ https://github.com/WongKinYiu/yolov9/releases/download/v0.1/yolov9-t-converted.pt
```  

📗 DataSet 구성 (Coco2017)

- yolov7 Repo.에 포함되어 있는 Coco Dataset 다운로드 스크립트를 사용한다.  
    - warboy-vision-models에서 사용하는 datasets과 동일한 데이터로 이루어져 있다.   

```shell
wget https://github.com/WongKinYiu/yolov7/blob/main/scripts/get_coco.sh

chmod +x get_coco.sh
./get_coco.sh
```  

```shell
##--  대략 27GB
##-- get_coco.sh 결과
coco/
├── annotations/                  # 주석(라벨) 원본 JSON (COCO 포맷)
│   └── instances_val2017.json    # val(검증) 이미지에 대한 바운딩박스 등 주석
├── images/                       # 실제 이미지
│   ├── train2017/                # 학습(train) 이미지
│   ├── val2017/                  # 검증(val) 이미지
│   └── test2017/                 # 테스트(test) 이미지(정답 라벨 공개X, 대회/서버 평가용)
├── labels/                       # YOLO 포맷(.txt)의 라벨 (이미지 1장 ↔ txt 1개)
│   ├── train2017/
│   └── val2017/
├── train2017.txt                 # 학습 이미지 경로 리스트(txt 한 줄에 이미지 1개 경로)
├── val2017.txt                   # 검증 이미지 경로 리스트
├── test-dev2017.txt              # 테스트 이미지 경로 리스트(서버 평가용 관례)
├── LICENSE, README.txt           # 데이터셋 라이선스/안내
```

### 시험 코드 구현

📗 Yolov9 기본 Repo.에서 제공 되는 시험 코드를 warboy-vision-models와 동일한 포맷으로 출력하도록 수정한다.  

- val.py : 기본 제공되는 정확도 측정용 파일 (mAP)  
- benchmarks.py : 기본 제공되는 FPS/Latency 측정용 파일  

📗 수정 코드

`val.py`  

- COCOeval 로그 출력 추가  
    - 추론, NMS, 정확도 계산, raw latency 기록  
- Accuracy Check (Success/Fail) 출력 추가  

- 모델 로딩  
    - PyTorch 모델을 GPU로 올리고, 필요 시, FP16 사용  
    - `DetectMultiBackend`는 Ultralytics Yolo에서 제공하는 warpper class  
        - Pytorch, onnx, tensorRT 등 다양한 백엔드를 공통 인터페이스로 로딩 가능하도록 함  

```python
model = DetectMultiBackend(weights, device=device, fp16=half)
```  

- 데이터로더 생성 (모델 추론 전, 이미지를 신경망에 사용할 수 있는 tensor로 변경하는 작업)
    - CoCo val2017 이미지를 배치 단위로 로드  
    - 파일 읽기 (JPEG/PNG → 배열 [H, W, C])  
    - 리사이즈/패딩 (640X640 등 모델 입력 크기 맞춤)  
    - 정규화 (0-255 → 0-1, float 변환)  
    - 배치 묶기 (N개 이미지를 한 텐서 [N,C,H,W]로)  
    - GPU 전송 (Tensor.to(device)) : CPU → GPU 메모리 복사  

    
```python
dataloader = create_dataloader(data['val'], imgsz, batch_size, ...)
``` 

`benchmarks.py`  

- p50, p90, p99 의 값 출력을 위해, 일부 수정 (per-images 시간 기록 추가)  
    - pre, infer, post per-image latency 리스트 수집  

📗 생성 코드  

`nvidia_e2e_val.py`  

- `val.py`와 `benchmarks.py`를 실행하여, mAP 및 FPS/Throughput에 대한 결과를 통합 출력

#### 기존 코드 수정

`val.py` 

- `dt = Profile(), Profile(), Profile()`로 전,후처리/추론 시간 세그먼트 분리  
    - `dt[0]`: Preprocess, `dt[1]`: Inference, `dt[2]`: NMS/Postprocess  

- Preprocess 계측  
    - GPU로 데이터 전송, nomalization 등 전처리 단계를 계측  
    - warboy의 Decoder 단계  
    - CPU에서 준비된 batch tensor를 GPU로 전송  
    - precision 변환 (F32/F16)  
    - normalization 수행  

```python
with dt[0]:
    if cuda:
        im = im.to(device, non_blocking=True)   # GPU 전송
        targets = targets.to(device)            # 라벨
    im = im.half() if half else im.float()      # F16, F32 변환
    im /= 255                                   # 정규화 (0-255 → 0-1)
```  

- Inference 계측  
    - Yolo 모델 forward pass를 계측  
    - warboy의 task.run() 단계  
    - `preds`: 각 feature map에서 나온 detection 결과 (box 좌표 + confidence + class score)  
    - `train_out`: 학습 시에는 loss 계산에 쓰이는 중간 값, 평가 시에는 필요 없음  

```python
with dt[1]:
    preds, train_out = model(im) if compute_loss else (model(im, augment=augment), None)
```

- Postprocess (NMS) 계측  
    - NMS 과정을 계측  
    - warboy의 Encoder/Postprocess 단계  
    - Yolo에 구현된 후처리 함수인 `non_max_suppression` 활용  
        - confidence threshold로 낮은 확률 후보 제거  
        - IoU(겹침 비율)가 높은 박스 중 가장 확률 높은 것만 남김    

```python
with dt[2]:
    preds = non_max_suppression(
        preds, conf_thres, iou_thres, labels=lb,
        multi_label=True, agnostic=single_cls, max_det=max_det
    )
```   

- per-image latency 기록  
    - 각 배치 시간을 per-image ms로 환산하여 리스트에 누적  
    - warboy의 `time_pre.results.append()`, `time_infer.results.append()` 단계  
    - 이중 `quantiles()` 함수로 평균/중위수/p90/p99 산출 가능  

```python
pre_ms = dt[0].dt * 1E3 / nb
inf_ms = dt[1].dt * 1E3 / nb
nms_ms = dt[2].dt * 1E3 / nb

pre_ms_list.extend([pre_ms] * nb)
inf_ms_list.extend([inf_ms] * nb)
nms_ms_list.extend([nms_ms] * nb)
```


📗 전체 코드 수정 사항

```diff
##-- ..

@smart_inference_mode()
def run(
##-- ..
        callbacks=Callbacks(),
        compute_loss=None,
        
+       return_raw=False    # raw latency 반환 여부
+       save_samples=0,
+       sample_start=1,
):

##-- .. 
    # Dataloader
    if not training:
        if pt and not single_cls:  # check --weights are trained on --data
            ncm = model.model.nc
            assert ncm == nc, f'{weights} ({ncm} classes) trained on different --data than what you passed ({nc} ' \
                              f'classes). Pass correct combination of --weights and --data that are trained together.'
        model.warmup(imgsz=(1 if pt else batch_size, 3, imgsz, imgsz))  # warmup
-       pad, rect = (0.0, False) if task == 'speed' else (0.5, pt)  # square inference for benchmarks
+       pad, rect = (0.0, False) if task == 'speed' else (0.5, False)
        task = task if task in ('train', 'val', 'test') else 'val'  # path to train/val/test images        
        dataloader = create_dataloader(data[task],
                                       imgsz,
                                       batch_size,
                                       stride,
                                       single_cls,
                                       pad=pad,
                                       rect=rect,
                                       workers=workers,
+                                      min_items=min_items,
-                                      min_items=opt.min_items,
+                                      shuffle=False,
                                       prefix=colorstr(f'{task}: '))[0]
+       ds = dataloader.dataset

    seen = 0
    confusion_matrix = ConfusionMatrix(nc=nc)
    names = model.names if hasattr(model, 'names') else model.module.names  # get class names
    if isinstance(names, (list, tuple)):  # old format
        names = dict(enumerate(names))
    class_map = coco80_to_coco91_class() if is_coco else list(range(1000))
    s = ('%22s' + '%11s' * 6) % ('Class', 'Images', 'Instances', 'P', 'R', 'mAP50', 'mAP50-95')
    tp, fp, p, r, f1, mp, mr, map50, ap50, map = 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    dt = Profile(), Profile(), Profile()  # profiling times
    loss = torch.zeros(3, device=device)
    jdict, stats, ap, ap_class = [], [], [], []
    callbacks.run('on_val_start')
    pbar = tqdm(dataloader, desc=s, bar_format=TQDM_BAR_FORMAT)  # progress bar

    
+   pre_ms_list, inf_ms_list, nms_ms_list = [], [], []

+   sample_dir = None
+   if save_samples > 0:
+       # sample_start 유효성
+       if sample_start < 1:
+           raise ValueError("--sample-start must be >=1 when --save-samples > 0")
+       # 모델명/배치사이즈 기반 디렉토리
+       model_name = Path(weights[0] if isinstance(weights, list) else weights).stem
+       sample_dir = Path("outputs") / f"{model_name}_{batch_size}"
+       if sample_dir.exists():
+           shutil.rmtree(sample_dir)
+       sample_dir.mkdir(parents=True, exist_ok=True)
+       chosen_ids = set(range(sample_start, sample_start + save_samples))
+       sample_count = 0

    for batch_i, (im, targets, paths, shapes) in enumerate(pbar):

##-- ..

+       pre_ms = dt[0].dt * 1E3 / nb
+       inf_ms = dt[1].dt * 1E3 / nb
+       nms_ms = dt[2].dt * 1E3 / nb
+       pre_ms_list.extend([pre_ms] * nb)
+       inf_ms_list.extend([inf_ms] * nb)
+       nms_ms_list.extend([nms_ms] * nb)

##-- ..
            # Save/log
            if save_txt:
                save_one_txt(predn, save_conf, shape, file=save_dir / 'labels' / f'{path.stem}.txt')
            if save_json:
                save_one_json(predn, jdict, path, class_map)  # append to COCO-JSON dictionary
            callbacks.run('on_val_image_end', pred, predn, path, names, im[si])

+           ##-- 추론 결과 이미지 저장
+           global_index = batch_i * batch_size + si + 1  # 1~5000 (1-based)
+           if save_samples > 0 and sample_count < save_samples and global_index in chosen_ids:
+               out_path = sample_dir / f"{path.stem}_pred.jpg"
+               #print(f"[DEBUG] Saving sample {sample_count+1}/{save_samples} to {out_path}")

+               # 항상 '원본 해상도' 이미지에 그린다 (predn은 이미 native-space 좌표)
+               # paths[si]가 상대경로이면 dataset 루트와 합쳐 절대경로로 변환
+               p = Path(paths[si])
+               if not p.is_absolute():
+                   base = Path(getattr(ds, "path", ""))  # 보통 datasets/coco
+                   p = (base / p).resolve()
+               img0 = cv2.imread(str(p))  # BGR
+               if img0 is None:
+                   print(f"[WARN] cv2.imread failed: {p}  → fallback to network input (640x640)")
                
+               # 디버그: 실제 저장 해상도 확인
+               #print(f"[DEBUG] drawing on original: {p.name} shape={img0.shape}")

+               h0, w0 = img0.shape[:2]

+               detn = predn.clone().detach().cpu()
+               # 안전하게 영역 클램프
+               detn[:, 0].clamp_(0, w0 - 1); detn[:, 2].clamp_(0, w0 - 1)
+               detn[:, 1].clamp_(0, h0 - 1); detn[:, 3].clamp_(0, h0 - 1)

+               for *xyxy, conf, cls in detn.tolist():
+                   c1 = (int(xyxy[0]), int(xyxy[1]))
+                   c2 = (int(xyxy[2]), int(xyxy[3]))
+                   name = names[int(cls)] if int(cls) in names else str(int(cls))
+                   label = f"{name} {conf:.2f}"
+                   cv2.rectangle(img0, c1, c2, (0, 255, 0), 2)
+                   cv2.putText(img0, label, (c1[0], max(c1[1]-5, 0)),
+                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

+               try:
+                   cv2.imwrite(str(out_path), img0)
+                   #print(f"[DEBUG] Saved sample image to {out_path}")
+               except Exception as e:
+                   print(f"[ERROR] Failed to save {out_path}: {e}")
+               sample_count += 1

##-- ..

    # Return results
    model.float()  # for training
    if not training:
        s = f"\n{len(list(save_dir.glob('labels/*.txt')))} labels saved to {save_dir / 'labels'}" if save_txt else ''
        LOGGER.info(f"Results saved to {colorstr('bold', save_dir)}{s}")
    maps = np.zeros(nc) + map
    for i, c in enumerate(ap_class):
        maps[c] = ap[i]
    
+    results = (mp, mr, map50, map, *(loss.cpu() / len(dataloader)).tolist())
+    if return_raw:
+        return results, maps, t, {"pre": pre_ms_list, "inf": inf_ms_list, "nms": nms_ms_list}
+    return results, maps, t    
-    #return (mp, mr, map50, map, *(loss.cpu() / len(dataloader)).tolist()), maps, t

##-- ..
def parse_opt():
    parser.add_argument('--min-items', type=int, default=0, help='Experimental')
+    parser.add_argument('--save-samples', type=int, default=0, help='Save N sample prediction images')
+    parser.add_argument('--sample-start', type=int, default=None,
+                        help='Starting dataset index (1-based) for saving samples. '
+                             'Valid only if --save-samples > 0')
```  


`benchmarks.py`  

- run()의 `# Validate, # DetectionModel`의 `result`, `metric`, `speed` 변경  
- `if pt_only == 0:` 부분 수정  
- `LOGGER` 수정, return 값에 `pre, inf, nms list 추가`  



📗 전체 코드 수정 사항

```diff
##-- ..

+ def _validate_model(model_type, data, w, batch_size, imgsz, device, half):
+     """Segmentation vs Detection 공통 벤치마크 함수"""
+     if model_type == SegmentationModel:
+         results, maps, times, raw_times = val_seg(
+             data, w, batch_size, imgsz,
+             plots=False, device=device, task='speed', half=half, return_raw=True
+         )
+         metric = results[0][7]  # segmentation metric
+     else:
+         results, maps, times, raw_times = val_det(
+             data, w, batch_size, imgsz,
+             plots=False, device=device, task='speed', half=half, return_raw=True
+         )
+         metric = results[3]  # detection metric
+ 
+     speed = times[1]
+     return metric, speed, raw_times

##-- ..

def run(

##-- ..

    y, t = [], time.time()
    device = select_device(device)
    model_type = type(attempt_load(weights, fuse=False))  # DetectionModel, SegmentationModel, etc.
    
+   pre_list, inf_list, nms_list = [], [], []

    for i, (name, f, suffix, cpu, gpu) in export.export_formats().iterrows():  # index, (name, file, suffix, CPU, GPU)
        try:

##-- ..           
            # Validate
-           if model_type == SegmentationModel:
-               result = val_seg(data, w, batch_size, imgsz, plots=False, device=device, task='speed', half=half)
-               metric = result[0][7]  # (box(p, r, map50, map), mask(p, r, map50, map), *loss(box, obj, cls))
-           else:  # DetectionModel:
-               result = val_det(data, w, batch_size, imgsz, plots=False, device=device, task='speed', half=half)
-               metric = result[0][3]  # (p, r, map50, map, *loss(box, obj, cls))
-           speed = result[2][1]  # times (preprocess, inference, postprocess)

+           metric, speed, raw_times = _validate_model(model_type, data, w, batch_size, imgsz, device, half)

+           # per-image latency 리스트 모으기
+           pre_list += raw_times["pre"]
+           inf_list += raw_times["inf"]
+           nms_list += raw_times["nms"]

            y.append([name, round(file_size(w), 1), round(metric, 4), round(speed, 2)])

        except Exception as e:
            if hard_fail:
-               assert type(e) is AssertionError, f'Benchmark --hard-fail for {name}: {e}'
+               assert isinstance(e, AssertionError), f'Benchmark --hard-fail for {name}: {e}'
            LOGGER.warning(f'WARNING ⚠️ Benchmark failure for {name}: {e}')
            y.append([name, None, None, None])  # mAP, t_inference

##-- ..

    # Print results
    LOGGER.info('\n')
-   parse_opt()
    notebook_init()  # print system info
-   c = ['Format', 'Size (MB)', 'mAP50-95', 'Inference time (ms)'] if map else ['Format', 'Export', '', '']
+   c = ['Format', 'Size (MB)', 'mAP50-95', 'Inference time (ms)']
    
    py = pd.DataFrame(y, columns=c)
    LOGGER.info(f'\nBenchmarks complete ({time.time() - t:.2f}s)')
-   LOGGER.info(str(py if map else py.iloc[:, :2]))
+   LOGGER.info(str(py))

-   if hard_fail and isinstance(hard_fail, str):
-       metrics = py['mAP50-95'].array  # values to compare to floor
-       floor = eval(hard_fail)  # minimum metric floor to pass
-       assert all(x > floor for x in metrics if pd.notna(x)), f'HARD FAIL: mAP50-95 < floor {floor}'
-   return py

+   # 최종 리턴: per-image latency
+   return {
+       "lat_pre": raw_times["pre"],
+       "lat_infer": raw_times["inf"],
+       "lat_post": raw_times["nms"]
+   }

 def test( 
```    


#### 신규 코드 생성

`nvidia_e2e_val.py`
- 📕 배치사이즈, 모델별 성능 측정을 `--simple` 설정으로 수행할 수 있도록 구성한다.
- `weights` 디렉토리 내의 `.pt` 값을 기준으로 batch_size 1~32까지 변경해가며 수행한다. 
    - 테스트 batch_size는 코드 내, `BATCH_SIZES = [1, 4, 8, 16, 32]`를 수정한다.

```python
#!/usr/bin/env python3
"""
Extended NVIDIA E2E validation script.

- Default: run_e2e() once with given args
- --simple: run across all GPUs, all weights, batch sizes [in BATCH_SIZES]
            and summarize results in Markdown tables.

Notes
- Tables show per-image metrics:
  * e2e_wall_per_image (img/s): per-image wall throughput (현재는 e2e_active와 동일)
  * e2e_active (img/s): 1000 / avg(e2e_ms)
  * infer_only (img/s): 1000 / avg(infer_ms)
- Device header is written to both full and result logs.
"""

import argparse, json, os, sys, time, re
from pathlib import Path
from datetime import datetime
from typing import Dict, List

import torch

from val import run as val_run
from benchmarks import run as bench_run

# -----------------------------
# Constants
# -----------------------------
REPO_ROOT = Path.cwd()
WEIGHT_DIR = REPO_ROOT / "weights"
START_TS = datetime.now().strftime("%Y%m%d_%H%M%S")
FULL_LOG_FILE = REPO_ROOT / f"nvidia_full_{START_TS}.log"
RESULT_LOG_FILE = REPO_ROOT / f"nvidia_result_{START_TS}.log"

# 원하는 배치 조합으로 수정 가능
BATCH_SIZES = [1, 4, 8, 16, 32]

TARGET_ACCURACY = {
    "yolov9t": 0.383,
    "yolov9s": 0.468,
    "yolov9m": 0.514,
    "yolov9c": 0.530,
    "yolov9e": 0.556,
    "yolov8n": 0.373,
    "yolov8l": 0.529,
}

# -----------------------------
# Logging helpers
# -----------------------------
def log_line(msg: str, both: bool = True):
    if msg == "":  # 빈 문자열이면 그냥 개행
        if both:
            print("", flush=True)
        try:
            with FULL_LOG_FILE.open("a", encoding="utf-8") as f:
                f.write("\n")
        except Exception:
            pass
        return

    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    if both:
        print(line, flush=True)
    try:
        with FULL_LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


# -----------------------------
# Utilities
# -----------------------------
def quantiles(arr):
    if not arr:
        return {"avg": None, "p50": None, "p90": None, "p99": None}
    arr_sorted = sorted(arr)
    n = len(arr_sorted)

    def pick(p):
        idx = max(0, min(n - 1, int(p * n) - 1))
        return arr_sorted[idx]

    return {
        "avg": sum(arr_sorted) / n,
        "p50": arr_sorted[n // 2],
        "p90": pick(0.90) if n >= 10 else None,
        "p99": pick(0.99) if n >= 100 else None,
    }


def run_e2e(opt):
    start = time.time()

    # 1) 마이크로 벤치(프리/인퍼/포스트 ms 리스트)
    lat_dict = bench_run(
        data=opt.data,
        weights=opt.weights,
        batch_size=opt.batch,
        imgsz=opt.img,
        device=opt.device,
        pt_only=True,
        half=opt.half,
    )
    e2e_ms_list = [p + i + n for p, i, n in zip(lat_dict["lat_pre"], lat_dict["lat_infer"], lat_dict["lat_post"])]

    # 2) 정확도(mAP) 측정
    results, maps, _ = val_run(
        data=opt.data,
        weights=opt.weights,
        batch_size=opt.batch,
        imgsz=opt.img,
        conf_thres=opt.conf,
        iou_thres=opt.iou,
        device=opt.device,
        save_json=True,
        name="e2e_val",
        half=opt.half,
    )

    mAP = results[3]
    model_name = Path(opt.weights).stem.replace("-converted", "").replace("-", "")
    target = TARGET_ACCURACY.get(model_name, 0.3) * 0.9
    acc_check = "success" if mAP >= target else "fail"

    # 3) 집계
    #sec = time.time() - start
    #images = len(pre_ms_list)
    #overall_wall = images / sec if sec > 0 else None  # 데이터셋 전체 처리율(표에는 미노출)

    e2e_q = quantiles(e2e_ms_list)
    pre_q = quantiles(lat_dict["lat_pre"])
    inf_q = quantiles(lat_dict["lat_infer"])
    post_q = quantiles(lat_dict["lat_post"])

    ## per-image throughput들
    #e2e_imgps = 1000.0 / e2e_q["avg"] if e2e_q["avg"] else None
    #infer_imgps = 1000.0 / inf_q["avg"] if inf_q["avg"] else None

    acc_check = "success" if mAP >= target else "fail"

    summary = {
        "model": model_name,
        "images": len(lat_dict["lat_pre"]),
        "throughput_img_per_s": {
            "e2e_wall_per_image": 1000.0 / e2e_q["avg"] if e2e_q["avg"] else None,
            "e2e_active": 1000.0 / e2e_q["avg"] if e2e_q["avg"] else None,
            "infer_only": 1000.0 / inf_q["avg"] if inf_q["avg"] else None
        },
        "latency_ms": {
            "pre": pre_q,
            "infer": inf_q,
            "post": post_q,
            "e2e_active": e2e_q,
        },
        "metrics": {
            "mAP": mAP,
            "target": target,
            "status": acc_check,
            "conf_thres": opt.conf,
            "iou_thres": opt.iou,
            "sec": time.time() - start,
        }
    }

    print(
        f"RESULT {model_name} bs={opt.batch} | "
        f"e2e_wall_imgps={summary['throughput_img_per_s']['e2e_wall_per_image']} "
        f"e2e_active={summary['throughput_img_per_s']['e2e_active']} "
        f"infer_only={summary['throughput_img_per_s']['infer_only']} | "
        f"lat_pre_avg={summary['latency_ms']['pre']['avg']} "
        f"lat_infer_avg={summary['latency_ms']['infer']['avg']} "
        f"lat_post_avg={summary['latency_ms']['post']['avg']} | "
        f"mAP={summary['metrics']['mAP']} target={summary['metrics']['target']} "
        f"status={summary['metrics']['status']} | "
        f"conf={summary['metrics']['conf_thres']} iou={summary['metrics']['iou_thres']} "
        f"sec={summary['metrics']['sec']:.2f}"
    )

    # 콘솔에도 JSON 한 번 출력(디버깅 가독성)
    print(json.dumps(summary, indent=2))

    return summary


def fmt(x):
    return "NA" if x is None else f"{x:.3f}"


def summarize_by_model(model: str, by_bs: Dict[int, dict]) -> str:
    first = next(iter(by_bs.values()))
    conf = fmt(first["metrics"].get("conf_thres"))
    iou = fmt(first["metrics"].get("iou_thres"))
    header = f"[model : {model}] : conf ({conf}), iou ({iou})"
    table = [
        "| batch_size | e2e_wall_per_image | e2e_active | infer_only | lat_pre | lat_infer | lat_post | mAP | Target | Status | sec |",
        "|------------|---------------------|------------|------------|---------|-----------|----------|-----|--------|--------|-----|",
    ]
    for bs in sorted(by_bs.keys()):
        r = by_bs[bs]
        thr = r["throughput_img_per_s"]
        lat = r["latency_ms"]
        acc = r["metrics"]
        table.append(
            f"| {bs} | {fmt(thr.get('e2e_wall_per_image'))} | "
            f"{fmt(thr.get('e2e_active'))} | {fmt(thr.get('infer_only'))} | "
            f"{fmt(lat['pre']['avg'])} | {fmt(lat['infer']['avg'])} | {fmt(lat['post']['avg'])} | "
            f"{fmt(acc['mAP'])} | {fmt(acc['target'])} | {acc['status']} | {fmt(acc['sec'])} |"
        )
    return "\n".join([header, ""] + table + [""])


def summarize_by_batch(batch: int, all_results: Dict[str, Dict[int, dict]]) -> str:
    first_model = next(iter(all_results.values()))
    first_res = first_model.get(batch, {})
    if first_res:
        conf_val = fmt(first_res["metrics"].get("conf_thres"))
        iou_val  = fmt(first_res["metrics"].get("iou_thres"))
    else:
        conf_val, iou_val = "NA", "NA"

    header = f"[batch_size : {batch}] : conf ({conf_val}), iou ({iou_val})"
    table = [
        "| model | e2e_wall_per_image | e2e_active | infer_only | lat_pre | lat_infer | lat_post | mAP | Target | Status | sec |",
        "|-------|---------------------|------------|------------|---------|-----------|----------|-----|--------|--------|-----|",
    ]
    for model, bs_dict in all_results.items():
        if batch not in bs_dict:
            continue
        r = bs_dict[batch]
        thr = r["throughput_img_per_s"]
        lat = r["latency_ms"]
        acc = r["metrics"]
        table.append(
            f"| {model} | {fmt(thr.get('e2e_wall_per_image'))} | "
            f"{fmt(thr.get('e2e_active'))} | {fmt(thr.get('infer_only'))} | "
            f"{fmt(lat['pre']['avg'])} | {fmt(lat['infer']['avg'])} | {fmt(lat['post']['avg'])} | "
            f"{fmt(acc['mAP'])} | {fmt(acc['target'])} | {acc['status']} | {fmt(acc['sec'])} |"
        )
    return "\n".join([header, ""] + table + [""])


def get_conf_iou(res: dict) -> tuple[str, str]:
    """metrics 블록에서 conf/iou 추출"""
    def fmt(x): return "NA" if x is None else f"{x:.3f}"
    m = res.get("metrics", {}) if res else {}
    return fmt(m.get("conf_thres")), fmt(m.get("iou_thres"))


def extract_metric_value(res: dict, metric: str):
    thr, lat, acc, comp = (
        res.get("throughput_img_per_s", {}),
        res.get("latency_ms", {}),
        res.get("metrics", {}),
        res.get("computed", {}),
    )
    if metric == "e2e_wall_per_image":
        return thr.get("e2e_wall_per_image") or comp.get("e2e_wall_per_image")
    elif metric == "e2e_active":
        return thr.get("e2e") or thr.get("e2e_active")
    elif metric == "infer_only":
        return thr.get("infer_only")
    elif metric == "lat_pre":
        return lat.get("pre", {}).get("avg")
    elif metric == "lat_infer":
        return lat.get("infer", {}).get("avg")
    elif metric == "lat_post":
        return lat.get("post", {}).get("avg")
    elif metric == "mAP":
        return acc.get("mAP")
    elif metric == "Target":
        return acc.get("target")
    elif metric == "Status":
        return acc.get("status")
    elif metric == "conf":
        return acc.get("conf_thres")
    elif metric == "iou":
        return acc.get("iou_thres")
    elif metric == "sec":
        return acc.get("sec")
    return None

def summarize_transposed_by_model(model: str, by_bs: Dict[int, dict]) -> str:
    def fmt(x): return "NA" if x is None else f"{x:.3f}"
    batch_sizes = sorted(by_bs.keys())

    # conf/iou는 모든 batch에서 동일 → 첫 값 사용
    first_res = next(iter(by_bs.values()))
    conf_val, iou_val = get_conf_iou(first_res)

    metrics = [
        "e2e_wall_per_image", "e2e_active", "infer_only",
        "lat_pre", "lat_infer", "lat_post",
        "mAP", "Target", "Status", "sec"
    ]

    rows = []
    for metric in metrics:
        row = [metric]
        for bs in batch_sizes:
            res = by_bs[bs]
            val = extract_metric_value(res, metric)
            row.append(fmt(val) if metric != "Status" else (val or "NA"))
        rows.append("| " + " | ".join(row) + " |")

    header = ["batch_size"] + [str(bs) for bs in batch_sizes]
    table = [
        f"[transposed summary: model={model}] : conf ({conf_val}), iou ({iou_val})",
        "",
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ] + rows
    return "\n".join(table) + "\n"


def summarize_transposed_by_batch(all_results: Dict[str, Dict[int, dict]], batch_size: int) -> str:
    def fmt(x): return "NA" if x is None else f"{x:.3f}"
    models = list(all_results.keys())

    # conf/iou는 모든 모델에서 동일하므로 첫 모델 값 사용
    first_model = next(iter(all_results.values()))
    first_res = first_model.get(batch_size, {})
    conf_val, iou_val = get_conf_iou(first_res)

    metrics = [
        "e2e_wall_per_image", "e2e_active", "infer_only",
        "lat_pre", "lat_infer", "lat_post",
        "mAP", "Target", "Status", "sec"
    ]

    rows = []
    for metric in metrics:
        row = [metric]
        for model in models:
            res = all_results[model].get(batch_size)
            if not res:
                row.append("NA")
                continue
            val = extract_metric_value(res, metric)
            row.append(fmt(val) if metric != "Status" else (val or "NA"))
        rows.append("| " + " | ".join(row) + " |")

    header = ["models"] + models
    table = [
        f"[transposed summary: batch_size={batch_size}] : conf ({conf_val}), iou ({iou_val})",
        "",
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ] + rows
    return "\n".join(table) + "\n"



# -----------------------------
# Main
# -----------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, default="data/coco.yaml")
    parser.add_argument("--weights", type=str, default="weights/yolov9t.pt")
    parser.add_argument("--img", type=int, default=640)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--conf", type=float, default=0.025)
    parser.add_argument("--iou", type=float, default=0.7)
    parser.add_argument("--device", type=str, default="0")
    parser.add_argument("--half", action="store_true")
    parser.add_argument(
        "--simple",
        action="store_true",
        help="Run all GPUs, all weights, batch sizes defined in BATCH_SIZES",
    )
    opt = parser.parse_args()

    if not opt.simple:
        summary = run_e2e(opt)
        print(json.dumps(summary, indent=2))
        return

    # --- Simple mode ---
    log_line("=" * 80)
    log_line(f"===== Simple Run started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} =====")
    log_line(f"Full log file: {FULL_LOG_FILE}")
    log_line(f"Result log file: {RESULT_LOG_FILE}")
    log_line("=" * 80)

    num_gpus = torch.cuda.device_count()
    weights = list(WEIGHT_DIR.glob("*.pt"))
    all_results: Dict[str, Dict[int, dict]] = {}

    for dev_id in range(num_gpus):
        name = torch.cuda.get_device_name(dev_id)
        log_line("=" * 80)
        log_line(f"[device {dev_id} : {name}]", both=True)
        log_line("=" * 80)
        try:
            with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                rf.write("=" * 80 + "\n")
                rf.write(f"[device {dev_id} : {name}]\n")
                rf.write("=" * 80 + "\n")
        except Exception:
            pass
        
        for w in weights:
            model_name = w.stem
            log_line(f"PROCESS MODEL: {model_name}")
            model_results: Dict[int, dict] = {}

            for bs in BATCH_SIZES:
                class Opt:
                    pass

                o = Opt()
                o.data, o.weights, o.img = opt.data, str(w), opt.img
                o.batch, o.conf, o.iou = bs, opt.conf, opt.iou
                o.device, o.half = str(dev_id), opt.half

                try:
                    res = run_e2e(o)
                    model_results[bs] = res
                    log_line(
                        f"RESULT {model_name} bs={bs} | "
                        f"mAP={res['metrics']['mAP']} target={res['metrics']['target']} "
                        f"status={res['metrics']['status']} | "
                        f"conf={res['metrics']['conf_thres']} iou={res['metrics']['iou_thres']} "
                        f"sec={res['metrics']['sec']:.2f}"
                    )
                except Exception as e:
                    log_line(f"[WARN] Failed for {model_name} bs={bs}: {e}")

            if model_results:
                all_results[model_name] = model_results
                summary = summarize_by_model(model_name, model_results)
                log_line("\n" + summary)
                try:
                    with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                        rf.write(summary + "\n\n")
                except Exception:
                    pass
                print(summary)

                summary_t = summarize_transposed_by_model(model_name, model_results)
                log_line("\n" + summary_t)
                with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                    rf.write(summary_t + "\n\n")
                print(summary_t)

        # batch별 요약(모든 모델 누적 기준)
        batch_sizes_present = sorted({bs for m in all_results.values() for bs in m.keys()})
        for bs in batch_sizes_present:
            summary = summarize_by_batch(bs, all_results)
            log_line("\n" + summary)
            print(summary)
            try:
                with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                    rf.write(summary + "\n\n")
            except Exception:
                pass

            # transpose 요약 추가
            summary_t = summarize_transposed_by_batch(all_results, bs)
            log_line("\n" + summary_t)
            print(summary_t)
            try:
                with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                    rf.write(summary_t + "\n\n")
            except Exception:
                pass

    log_line("All done.")


if __name__ == "__main__":
    main()
```

📗 실행 결과

```shell
##-- 실행 결과 예 >
(venv) kcloud@k8s-worker1:~/nvidia-yolo/yolov9$ python nvidia_e2e_val.py
[2025-09-12 13:54:53] ================================================================================
[2025-09-12 13:54:53] ===== Simple Run started at 2025-09-12 13:54:53 =====
[2025-09-12 13:54:53] Full log file: /home/kcloud/nvidia-yolo/yolov9/nvidia_full_20250912_135453.log
[2025-09-12 13:54:53] Result log file: /home/kcloud/nvidia-yolo/yolov9/nvidia_result_20250912_135453.log
[2025-09-12 13:54:53] ================================================================================
[2025-09-12 13:54:53] ================================================================================
[2025-09-12 13:54:53] [device 0 : NVIDIA A30]
[2025-09-12 13:54:53] ================================================================================
[2025-09-12 13:54:53] PROCESS MODEL: yolov9c
[2025-09-12 13:58:41] RESULT yolov9c bs=1 | mAP=0.5195542629781255 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=227.39
[2025-09-12 14:01:04] RESULT yolov9c bs=4 | mAP=0.5195468467796467 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=143.35
[2025-09-12 14:03:22] RESULT yolov9c bs=8 | mAP=0.5195541129312263 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=137.77
[2025-09-12 14:05:39] RESULT yolov9c bs=16 | mAP=0.5195154961790275 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=137.07
[2025-09-12 14:07:54] RESULT yolov9c bs=32 | mAP=0.5194352019981747 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=135.31
[2025-09-12 14:07:54] 
[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_wall_per_image | e2e_active | infer_only | lat_pre | lat_infer | lat_post | mAP | Target | Status | sec |
|------------|---------------------|------------|------------|---------|-----------|----------|-----|--------|--------|-----|
| 1 | 77.850 | 77.850 | 86.395 | 0.276 | 11.575 | 0.994 | 0.520 | 0.477 | success | 227.392 |
| 4 | 129.449 | 129.449 | 147.151 | 0.140 | 6.796 | 0.789 | 0.520 | 0.477 | success | 143.354 |
| 8 | 136.715 | 136.715 | 156.617 | 0.132 | 6.385 | 0.797 | 0.520 | 0.477 | success | 137.773 |
| 16 | 136.945 | 136.945 | 157.012 | 0.130 | 6.369 | 0.804 | 0.520 | 0.477 | success | 137.073 |
| 32 | 138.720 | 138.720 | 158.203 | 0.130 | 6.321 | 0.758 | 0.519 | 0.477 | success | 135.313 |

[2025-09-12 14:07:54] 
[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_wall_per_image | 77.850 | 129.449 | 136.715 | 136.945 | 138.720 |
| e2e_active | 77.850 | 129.449 | 136.715 | 136.945 | 138.720 |
| infer_only | 86.395 | 147.151 | 156.617 | 157.012 | 158.203 |
| lat_pre | 0.276 | 0.140 | 0.132 | 0.130 | 0.130 |
| lat_infer | 11.575 | 6.796 | 6.385 | 6.369 | 6.321 |
| lat_post | 0.994 | 0.789 | 0.797 | 0.804 | 0.758 |
| mAP | 0.520 | 0.520 | 0.520 | 0.520 | 0.519 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec | 227.392 | 143.354 | 137.773 | 137.073 | 135.313 |

[2025-09-12 14:07:54] PROCESS MODEL: yolov8n
[2025-09-12 14:10:43] RESULT yolov8n bs=1 | mAP=0.3661093731904903 target=0.3357 status=success | conf=0.025 iou=0.7 sec=168.47
[2025-09-12 14:12:19] RESULT yolov8n bs=4 | mAP=0.3660894677880994 target=0.3357 status=success | conf=0.025 iou=0.7 sec=96.50
[2025-09-12 14:13:55] RESULT yolov8n bs=8 | mAP=0.3661183567951654 target=0.3357 status=success | conf=0.025 iou=0.7 sec=95.33
[2025-09-12 14:15:28] RESULT yolov8n bs=16 | mAP=0.3661316638977449 target=0.3357 status=success | conf=0.025 iou=0.7 sec=93.20
[2025-09-12 14:17:00] RESULT yolov8n bs=32 | mAP=0.3663856001111535 target=0.3357 status=success | conf=0.025 iou=0.7 sec=91.79
[2025-09-12 14:17:00] 
[model : yolov8n] : conf (0.025), iou (0.700)

| batch_size | e2e_wall_per_image | e2e_active | infer_only | lat_pre | lat_infer | lat_post | mAP | Target | Status | sec |
|------------|---------------------|------------|------------|---------|-----------|----------|-----|--------|--------|-----|
| 1 | 159.909 | 159.909 | 203.524 | 0.243 | 4.913 | 1.097 | 0.366 | 0.336 | success | 168.467 |
| 4 | 423.913 | 423.913 | 752.725 | 0.139 | 1.329 | 0.892 | 0.366 | 0.336 | success | 96.495 |
| 8 | 474.632 | 474.632 | 922.031 | 0.131 | 1.085 | 0.892 | 0.366 | 0.336 | success | 95.331 |
| 16 | 491.179 | 491.179 | 985.532 | 0.127 | 1.015 | 0.894 | 0.366 | 0.336 | success | 93.198 |
| 32 | 507.636 | 507.636 | 1019.979 | 0.125 | 0.980 | 0.864 | 0.366 | 0.336 | success | 91.794 |

[2025-09-12 14:17:00] 
[transposed summary: model=yolov8n] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_wall_per_image | 159.909 | 423.913 | 474.632 | 491.179 | 507.636 |
| e2e_active | 159.909 | 423.913 | 474.632 | 491.179 | 507.636 |
| infer_only | 203.524 | 752.725 | 922.031 | 985.532 | 1019.979 |
| lat_pre | 0.243 | 0.139 | 0.131 | 0.127 | 0.125 |
| lat_infer | 4.913 | 1.329 | 1.085 | 1.015 | 0.980 |
| lat_post | 1.097 | 0.892 | 0.892 | 0.894 | 0.864 |
| mAP | 0.366 | 0.366 | 0.366 | 0.366 | 0.366 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success | success |
| sec | 168.467 | 96.495 | 95.331 | 93.198 | 91.794 |
```  

📗 yolov8n, yolov8l, yolov9t, yolov9c 의 배치사이즈 [1, 4, 8, 16, 32] 수행 결과  

- **coco dataset, val2017 (5,000장), object_detection**

`[device 0 : NVIDIA A30]` 📗

[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 82.751 | 91.937 | 0.276 | 10.877 | 0.932 | 0.520 | 0.477 | success | 224.997 |
| 4 | 128.964 | 146.835 | 0.140 | 6.810 | 0.803 | 0.520 | 0.477 | success | 144.874 |
| 8 | 136.153 | 156.225 | 0.133 | 6.401 | 0.811 | 0.520 | 0.477 | success | 140.146 |
| 16 | 136.503 | 156.859 | 0.130 | 6.375 | 0.821 | 0.520 | 0.477 | success | 137.848 |
| 32 | 138.150 | 157.827 | 0.130 | 6.336 | 0.772 | 0.519 | 0.477 | success | 137.811 |


[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.751 | 128.964 | 136.153 | 136.503 | 138.150 |
| infer_only (img/s) | 91.937 | 146.835 | 156.225 | 156.859 | 157.827 |
| lat_pre (ms) | 0.276 | 0.140 | 0.133 | 0.130 | 0.130 |
| lat_infer (ms) | 10.877 | 6.810 | 6.401 | 6.375 | 6.336 |
| lat_post (ms) | 0.932 | 0.803 | 0.811 | 0.821 | 0.772 |
| mAP | 0.520 | 0.520 | 0.520 | 0.520 | 0.519 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec (s) | 224.997 | 144.874 | 140.146 | 137.848 | 137.811 |


[model : yolov8n] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 157.693 | 201.456 | 0.266 | 4.964 | 1.111 | 0.366 | 0.336 | success | 172.000 |
| 4 | 389.722 | 677.341 | 0.140 | 1.476 | 0.949 | 0.366 | 0.336 | success | 99.171 |
| 8 | 387.524 | 800.495 | 0.134 | 1.249 | 1.197 | 0.366 | 0.336 | success | 110.235 |
| 16 | 426.023 | 874.435 | 0.132 | 1.144 | 1.072 | 0.366 | 0.336 | success | 104.064 |
| 32 | 454.901 | 940.557 | 0.127 | 1.063 | 1.008 | 0.366 | 0.336 | success | 96.383 |


[transposed summary: model=yolov8n] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 157.693 | 389.722 | 387.524 | 426.023 | 454.901 |
| infer_only (img/s) | 201.456 | 677.341 | 800.495 | 874.435 | 940.557 |
| lat_pre (ms) | 0.266 | 0.140 | 0.134 | 0.132 | 0.127 |
| lat_infer (ms) | 4.964 | 1.476 | 1.249 | 1.144 | 1.063 |
| lat_post (ms) | 1.111 | 0.949 | 1.197 | 1.072 | 1.008 |
| mAP | 0.366 | 0.366 | 0.366 | 0.366 | 0.366 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success | success |
| sec (s) | 172.000 | 99.171 | 110.235 | 104.064 | 96.383 |


[model : yolov9t] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 73.931 | 81.833 | 0.274 | 12.220 | 1.032 | 0.372 | 0.345 | success | 239.193 |
| 4 | 220.664 | 285.576 | 0.139 | 3.502 | 0.891 | 0.372 | 0.345 | success | 115.611 |
| 8 | 331.253 | 502.469 | 0.131 | 1.990 | 0.898 | 0.372 | 0.345 | success | 102.671 |
| 16 | 411.264 | 683.271 | 0.128 | 1.464 | 0.840 | 0.373 | 0.345 | success | 97.777 |
| 32 | 430.183 | 727.277 | 0.126 | 1.375 | 0.823 | 0.373 | 0.345 | success | 95.755 |


[transposed summary: model=yolov9t] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 73.931 | 220.664 | 331.253 | 411.264 | 430.183 |
| infer_only (img/s) | 81.833 | 285.576 | 502.469 | 683.271 | 727.277 |
| lat_pre (ms) | 0.274 | 0.139 | 0.131 | 0.128 | 0.126 |
| lat_infer (ms) | 12.220 | 3.502 | 1.990 | 1.464 | 1.375 |
| lat_post (ms) | 1.032 | 0.891 | 0.898 | 0.840 | 0.823 |
| mAP | 0.372 | 0.372 | 0.372 | 0.373 | 0.373 |
| Target | 0.345 | 0.345 | 0.345 | 0.345 | 0.345 |
| Status | success | success | success | success | success |
| sec (s) | 239.193 | 115.611 | 102.671 | 97.777 | 95.755 |


[model : yolov8l] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 93.100 | 104.579 | 0.277 | 9.562 | 0.902 | 0.519 | 0.476 | success | 210.516 |
| 4 | 123.324 | 139.424 | 0.139 | 7.172 | 0.797 | 0.519 | 0.476 | success | 146.052 |
| 8 | 131.785 | 150.490 | 0.131 | 6.645 | 0.812 | 0.519 | 0.476 | success | 144.505 |
| 16 | 132.271 | 152.010 | 0.128 | 6.579 | 0.854 | 0.519 | 0.476 | success | 144.028 |
| 32 | 133.883 | 153.208 | 0.125 | 6.527 | 0.817 | 0.519 | 0.476 | success | 143.196 |


[transposed summary: model=yolov8l] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 93.100 | 123.324 | 131.785 | 132.271 | 133.883 |
| infer_only (img/s) | 104.579 | 139.424 | 150.490 | 152.010 | 153.208 |
| lat_pre (ms) | 0.277 | 0.139 | 0.131 | 0.128 | 0.125 |
| lat_infer (ms) | 9.562 | 7.172 | 6.645 | 6.579 | 6.527 |
| lat_post (ms) | 0.902 | 0.797 | 0.812 | 0.854 | 0.817 |
| mAP | 0.519 | 0.519 | 0.519 | 0.519 | 0.519 |
| Target | 0.476 | 0.476 | 0.476 | 0.476 | 0.476 |
| Status | success | success | success | success | success |
| sec (s) | 210.516 | 146.052 | 144.505 | 144.028 | 143.196 |


[batch_size : 1] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 82.751 | 91.937 | 0.276 | 10.877 | 0.932 | 0.520 | 0.477 | success | 224.997 |
| yolov8n | 157.693 | 201.456 | 0.266 | 4.964 | 1.111 | 0.366 | 0.336 | success | 172.000 |
| yolov9t | 73.931 | 81.833 | 0.274 | 12.220 | 1.032 | 0.372 | 0.345 | success | 239.193 |
| yolov8l | 93.100 | 104.579 | 0.277 | 9.562 | 0.902 | 0.519 | 0.476 | success | 210.516 |


[transposed summary: batch_size=1] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.751 | 157.693 | 73.931 | 93.100 |
| infer_only (img/s) | 91.937 | 201.456 | 81.833 | 104.579 |
| lat_pre (ms) | 0.276 | 0.266 | 0.274 | 0.277 |
| lat_infer (ms) | 10.877 | 4.964 | 12.220 | 9.562 |
| lat_post (ms) | 0.932 | 1.111 | 1.032 | 0.902 |
| mAP | 0.520 | 0.366 | 0.372 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 224.997 | 172.000 | 239.193 | 210.516 |


[batch_size : 4] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 128.964 | 146.835 | 0.140 | 6.810 | 0.803 | 0.520 | 0.477 | success | 144.874 |
| yolov8n | 389.722 | 677.341 | 0.140 | 1.476 | 0.949 | 0.366 | 0.336 | success | 99.171 |
| yolov9t | 220.664 | 285.576 | 0.139 | 3.502 | 0.891 | 0.372 | 0.345 | success | 115.611 |
| yolov8l | 123.324 | 139.424 | 0.139 | 7.172 | 0.797 | 0.519 | 0.476 | success | 146.052 |


[transposed summary: batch_size=4] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 128.964 | 389.722 | 220.664 | 123.324 |
| infer_only (img/s) | 146.835 | 677.341 | 285.576 | 139.424 |
| lat_pre (ms) | 0.140 | 0.140 | 0.139 | 0.139 |
| lat_infer (ms) | 6.810 | 1.476 | 3.502 | 7.172 |
| lat_post (ms) | 0.803 | 0.949 | 0.891 | 0.797 |
| mAP | 0.520 | 0.366 | 0.372 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 144.874 | 99.171 | 115.611 | 146.052 |


[batch_size : 8] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 136.153 | 156.225 | 0.133 | 6.401 | 0.811 | 0.520 | 0.477 | success | 140.146 |
| yolov8n | 387.524 | 800.495 | 0.134 | 1.249 | 1.197 | 0.366 | 0.336 | success | 110.235 |
| yolov9t | 331.253 | 502.469 | 0.131 | 1.990 | 0.898 | 0.372 | 0.345 | success | 102.671 |
| yolov8l | 131.785 | 150.490 | 0.131 | 6.645 | 0.812 | 0.519 | 0.476 | success | 144.505 |


[transposed summary: batch_size=8] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.153 | 387.524 | 331.253 | 131.785 |
| infer_only (img/s) | 156.225 | 800.495 | 502.469 | 150.490 |
| lat_pre (ms) | 0.133 | 0.134 | 0.131 | 0.131 |
| lat_infer (ms) | 6.401 | 1.249 | 1.990 | 6.645 |
| lat_post (ms) | 0.811 | 1.197 | 0.898 | 0.812 |
| mAP | 0.520 | 0.366 | 0.372 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 140.146 | 110.235 | 102.671 | 144.505 |


[batch_size : 16] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 136.503 | 156.859 | 0.130 | 6.375 | 0.821 | 0.520 | 0.477 | success | 137.848 |
| yolov8n | 426.023 | 874.435 | 0.132 | 1.144 | 1.072 | 0.366 | 0.336 | success | 104.064 |
| yolov9t | 411.264 | 683.271 | 0.128 | 1.464 | 0.840 | 0.373 | 0.345 | success | 97.777 |
| yolov8l | 132.271 | 152.010 | 0.128 | 6.579 | 0.854 | 0.519 | 0.476 | success | 144.028 |


[transposed summary: batch_size=16] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.503 | 426.023 | 411.264 | 132.271 |
| infer_only (img/s) | 156.859 | 874.435 | 683.271 | 152.010 |
| lat_pre (ms) | 0.130 | 0.132 | 0.128 | 0.128 |
| lat_infer (ms) | 6.375 | 1.144 | 1.464 | 6.579 |
| lat_post (ms) | 0.821 | 1.072 | 0.840 | 0.854 |
| mAP | 0.520 | 0.366 | 0.373 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 137.848 | 104.064 | 97.777 | 144.028 |


[batch_size : 32] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 138.150 | 157.827 | 0.130 | 6.336 | 0.772 | 0.519 | 0.477 | success | 137.811 |
| yolov8n | 454.901 | 940.557 | 0.127 | 1.063 | 1.008 | 0.366 | 0.336 | success | 96.383 |
| yolov9t | 430.183 | 727.277 | 0.126 | 1.375 | 0.823 | 0.373 | 0.345 | success | 95.755 |
| yolov8l | 133.883 | 153.208 | 0.125 | 6.527 | 0.817 | 0.519 | 0.476 | success | 143.196 |


[transposed summary: batch_size=32] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 138.150 | 454.901 | 430.183 | 133.883 |
| infer_only (img/s) | 157.827 | 940.557 | 727.277 | 153.208 |
| lat_pre (ms) | 0.130 | 0.127 | 0.126 | 0.125 |
| lat_infer (ms) | 6.336 | 1.063 | 1.375 | 6.527 |
| lat_post (ms) | 0.772 | 1.008 | 0.823 | 0.817 |
| mAP | 0.519 | 0.366 | 0.373 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 137.811 | 96.383 | 95.755 | 143.196 |



`[device 1 : NVIDIA A2] [f32]` 📗


[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 80.105 | 88.602 | 0.252 | 11.286 | 0.945 | 0.520 | 0.477 | success | 232.199 |
| 4 | 128.144 | 146.435 | 0.140 | 6.829 | 0.834 | 0.520 | 0.477 | success | 148.354 |
| 8 | 135.490 | 156.653 | 0.131 | 6.384 | 0.866 | 0.520 | 0.477 | success | 142.942 |
| 16 | 136.997 | 157.828 | 0.127 | 6.336 | 0.836 | 0.520 | 0.477 | success | 140.202 |
| 32 | 138.970 | 159.147 | 0.125 | 6.283 | 0.787 | 0.519 | 0.477 | success | 136.993 |


[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 80.105 | 128.144 | 135.490 | 136.997 | 138.970 |
| infer_only (img/s) | 88.602 | 146.435 | 156.653 | 157.828 | 159.147 |
| lat_pre (ms) | 0.252 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 11.286 | 6.829 | 6.384 | 6.336 | 6.283 |
| lat_post (ms) | 0.945 | 0.834 | 0.866 | 0.836 | 0.787 |
| mAP | 0.520 | 0.520 | 0.520 | 0.520 | 0.519 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec (s) | 232.199 | 148.354 | 142.942 | 140.202 | 136.993 |


[model : yolov8n] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 155.930 | 197.836 | 0.230 | 5.055 | 1.128 | 0.366 | 0.336 | success | 172.108 |
| 4 | 377.440 | 653.303 | 0.141 | 1.531 | 0.978 | 0.366 | 0.336 | success | 100.852 |
| 8 | 471.549 | 918.865 | 0.131 | 1.088 | 0.901 | 0.366 | 0.336 | success | 101.476 |
| 16 | 475.200 | 977.016 | 0.128 | 1.024 | 0.953 | 0.366 | 0.336 | success | 99.081 |
| 32 | 498.547 | 1019.836 | 0.126 | 0.981 | 0.900 | 0.366 | 0.336 | success | 97.550 |


[transposed summary: model=yolov8n] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 155.930 | 377.440 | 471.549 | 475.200 | 498.547 |
| infer_only (img/s) | 197.836 | 653.303 | 918.865 | 977.016 | 1019.836 |
| lat_pre (ms) | 0.230 | 0.141 | 0.131 | 0.128 | 0.126 |
| lat_infer (ms) | 5.055 | 1.531 | 1.088 | 1.024 | 0.981 |
| lat_post (ms) | 1.128 | 0.978 | 0.901 | 0.953 | 0.900 |
| mAP | 0.366 | 0.366 | 0.366 | 0.366 | 0.366 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success | success |
| sec (s) | 172.108 | 100.852 | 101.476 | 99.081 | 97.550 |


[model : yolov9t] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 72.407 | 80.115 | 0.279 | 12.482 | 1.050 | 0.372 | 0.345 | success | 240.377 |
| 4 | 214.799 | 276.967 | 0.139 | 3.611 | 0.906 | 0.372 | 0.345 | success | 123.290 |
| 8 | 325.956 | 496.473 | 0.131 | 2.014 | 0.923 | 0.372 | 0.345 | success | 108.139 |
| 16 | 404.392 | 681.532 | 0.128 | 1.467 | 0.878 | 0.373 | 0.345 | success | 103.255 |
| 32 | 422.144 | 721.095 | 0.126 | 1.387 | 0.856 | 0.373 | 0.345 | success | 100.769 |


[transposed summary: model=yolov9t] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 72.407 | 214.799 | 325.956 | 404.392 | 422.144 |
| infer_only (img/s) | 80.115 | 276.967 | 496.473 | 681.532 | 721.095 |
| lat_pre (ms) | 0.279 | 0.139 | 0.131 | 0.128 | 0.126 |
| lat_infer (ms) | 12.482 | 3.611 | 2.014 | 1.467 | 1.387 |
| lat_post (ms) | 1.050 | 0.906 | 0.923 | 0.878 | 0.856 |
| mAP | 0.372 | 0.372 | 0.372 | 0.373 | 0.373 |
| Target | 0.345 | 0.345 | 0.345 | 0.345 | 0.345 |
| Status | success | success | success | success | success |
| sec (s) | 240.377 | 123.290 | 108.139 | 103.255 | 100.769 |


[model : yolov8l] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 93.006 | 104.449 | 0.244 | 9.574 | 0.934 | 0.519 | 0.476 | success | 213.898 |
| 4 | 120.962 | 140.000 | 0.141 | 7.143 | 0.983 | 0.519 | 0.476 | success | 151.427 |
| 8 | 131.902 | 150.571 | 0.131 | 6.641 | 0.809 | 0.519 | 0.476 | success | 142.677 |
| 16 | 132.781 | 151.998 | 0.127 | 6.579 | 0.825 | 0.519 | 0.476 | success | 140.534 |
| 32 | 134.787 | 153.161 | 0.125 | 6.529 | 0.765 | 0.519 | 0.476 | success | 137.042 |


[transposed summary: model=yolov8l] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 93.006 | 120.962 | 131.902 | 132.781 | 134.787 |
| infer_only (img/s) | 104.449 | 140.000 | 150.571 | 151.998 | 153.161 |
| lat_pre (ms) | 0.244 | 0.141 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 9.574 | 7.143 | 6.641 | 6.579 | 6.529 |
| lat_post (ms) | 0.934 | 0.983 | 0.809 | 0.825 | 0.765 |
| mAP | 0.519 | 0.519 | 0.519 | 0.519 | 0.519 |
| Target | 0.476 | 0.476 | 0.476 | 0.476 | 0.476 |
| Status | success | success | success | success | success |
| sec (s) | 213.898 | 151.427 | 142.677 | 140.534 | 137.042 |


[batch_size : 1] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 80.105 | 88.602 | 0.252 | 11.286 | 0.945 | 0.520 | 0.477 | success | 232.199 |
| yolov8n | 155.930 | 197.836 | 0.230 | 5.055 | 1.128 | 0.366 | 0.336 | success | 172.108 |
| yolov9t | 72.407 | 80.115 | 0.279 | 12.482 | 1.050 | 0.372 | 0.345 | success | 240.377 |
| yolov8l | 93.006 | 104.449 | 0.244 | 9.574 | 0.934 | 0.519 | 0.476 | success | 213.898 |


[transposed summary: batch_size=1] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 80.105 | 155.930 | 72.407 | 93.006 |
| infer_only (img/s) | 88.602 | 197.836 | 80.115 | 104.449 |
| lat_pre (ms) | 0.252 | 0.230 | 0.279 | 0.244 |
| lat_infer (ms) | 11.286 | 5.055 | 12.482 | 9.574 |
| lat_post (ms) | 0.945 | 1.128 | 1.050 | 0.934 |
| mAP | 0.520 | 0.366 | 0.372 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 232.199 | 172.108 | 240.377 | 213.898 |


[batch_size : 4] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 128.144 | 146.435 | 0.140 | 6.829 | 0.834 | 0.520 | 0.477 | success | 148.354 |
| yolov8n | 377.440 | 653.303 | 0.141 | 1.531 | 0.978 | 0.366 | 0.336 | success | 100.852 |
| yolov9t | 214.799 | 276.967 | 0.139 | 3.611 | 0.906 | 0.372 | 0.345 | success | 123.290 |
| yolov8l | 120.962 | 140.000 | 0.141 | 7.143 | 0.983 | 0.519 | 0.476 | success | 151.427 |


[transposed summary: batch_size=4] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 128.144 | 377.440 | 214.799 | 120.962 |
| infer_only (img/s) | 146.435 | 653.303 | 276.967 | 140.000 |
| lat_pre (ms) | 0.140 | 0.141 | 0.139 | 0.141 |
| lat_infer (ms) | 6.829 | 1.531 | 3.611 | 7.143 |
| lat_post (ms) | 0.834 | 0.978 | 0.906 | 0.983 |
| mAP | 0.520 | 0.366 | 0.372 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 148.354 | 100.852 | 123.290 | 151.427 |


[batch_size : 8] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 135.490 | 156.653 | 0.131 | 6.384 | 0.866 | 0.520 | 0.477 | success | 142.942 |
| yolov8n | 471.549 | 918.865 | 0.131 | 1.088 | 0.901 | 0.366 | 0.336 | success | 101.476 |
| yolov9t | 325.956 | 496.473 | 0.131 | 2.014 | 0.923 | 0.372 | 0.345 | success | 108.139 |
| yolov8l | 131.902 | 150.571 | 0.131 | 6.641 | 0.809 | 0.519 | 0.476 | success | 142.677 |


[transposed summary: batch_size=8] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 135.490 | 471.549 | 325.956 | 131.902 |
| infer_only (img/s) | 156.653 | 918.865 | 496.473 | 150.571 |
| lat_pre (ms) | 0.131 | 0.131 | 0.131 | 0.131 |
| lat_infer (ms) | 6.384 | 1.088 | 2.014 | 6.641 |
| lat_post (ms) | 0.866 | 0.901 | 0.923 | 0.809 |
| mAP | 0.520 | 0.366 | 0.372 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 142.942 | 101.476 | 108.139 | 142.677 |


[batch_size : 16] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 136.997 | 157.828 | 0.127 | 6.336 | 0.836 | 0.520 | 0.477 | success | 140.202 |
| yolov8n | 475.200 | 977.016 | 0.128 | 1.024 | 0.953 | 0.366 | 0.336 | success | 99.081 |
| yolov9t | 404.392 | 681.532 | 0.128 | 1.467 | 0.878 | 0.373 | 0.345 | success | 103.255 |
| yolov8l | 132.781 | 151.998 | 0.127 | 6.579 | 0.825 | 0.519 | 0.476 | success | 140.534 |


[transposed summary: batch_size=16] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.997 | 475.200 | 404.392 | 132.781 |
| infer_only (img/s) | 157.828 | 977.016 | 681.532 | 151.998 |
| lat_pre (ms) | 0.127 | 0.128 | 0.128 | 0.127 |
| lat_infer (ms) | 6.336 | 1.024 | 1.467 | 6.579 |
| lat_post (ms) | 0.836 | 0.953 | 0.878 | 0.825 |
| mAP | 0.520 | 0.366 | 0.373 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 140.202 | 99.081 | 103.255 | 140.534 |


[batch_size : 32] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 138.970 | 159.147 | 0.125 | 6.283 | 0.787 | 0.519 | 0.477 | success | 136.993 |
| yolov8n | 498.547 | 1019.836 | 0.126 | 0.981 | 0.900 | 0.366 | 0.336 | success | 97.550 |
| yolov9t | 422.144 | 721.095 | 0.126 | 1.387 | 0.856 | 0.373 | 0.345 | success | 100.769 |
| yolov8l | 134.787 | 153.161 | 0.125 | 6.529 | 0.765 | 0.519 | 0.476 | success | 137.042 |


[transposed summary: batch_size=32] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 138.970 | 498.547 | 422.144 | 134.787 |
| infer_only (img/s) | 159.147 | 1019.836 | 721.095 | 153.161 |
| lat_pre (ms) | 0.125 | 0.126 | 0.126 | 0.125 |
| lat_infer (ms) | 6.283 | 0.981 | 1.387 | 6.529 |
| lat_post (ms) | 0.787 | 0.900 | 0.856 | 0.765 |
| mAP | 0.519 | 0.366 | 0.373 | 0.519 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 136.993 | 97.550 | 100.769 | 137.042 |



--- 
