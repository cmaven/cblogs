# 3. Object Detection

## 3.1 Furiosa Warboy (Yolov7)

🔗 [https://github.com/furiosa-ai/yolov7](https://github.com/furiosa-ai/yolov7)

### 사전 환경

```shell
mkdir ~/furiosa-yolov7
cd ~/furiosa-yolov7

git clone https://github.com/furiosa-ai/yolov7.git

cd yolov7
wget https://github.com/WongKinYiu/yolov7/releases/download/v0.1/yolov7.pt

git clone https://github.com/WongKinYiu/yolov7
```  

위의 명령어를 수행하면 furiosa-ai의 yolov7 repo. 안에, yolov7 official(By WongKinYiu) repo.가 포함된다.

```shell
python3 -m venv venv
source venv/bin/activate

cd ~/furiosa-yolo7/yolov7

##-- (venv)
pip install -r requirements.txt
##-- 기존 requirements는 0.9.1 runtime 기준이므로, 전체 sdk를 업그레이드 해준다. 
pip install --upgrade "furiosa-sdk[full]"
##-- 또는 pip list 확인 후, 버전에 맞추어
pip install "furiosa-sdk[full]==0.10.2"

sudo apt-get update
sudo apt-get install -y libgl1 libglib2.0-0
``` 

📕 버전 문제 발생 시, `pip install --upgrade "furiosa-sdk[full]"` 수행하는 이유  

🔗 [https://forums.furiosa.ai/t/furiosa-sdk-0-10-0/52/4](https://forums.furiosa.ai/t/furiosa-sdk-0-10-0/52/4)


### ONNX 변환, 양자화

```shell
##-- onnx 추출, 양자화, 평가 

python3 onnx_export.py --weights=./yolov7.pt --onnx_path=./yolov7.onnx --opset_version=13 --model_input_name=images --model_output_name=outputs

python3 furiosa_quantize.py --onnx_path=./yolov7.onnx --dfg_path=./yolov7.dfg --opset_version=13 --calib_data=./images/train --model_input_name=images
```

### 평가

```shell
python3 furiosa_eval.py --dfg_path=./yolov7.dfg --eval_data_path=./images/test --output_path=./output
```  

```shell
##-- 실행 결과 예 (python3.9에서, python 명령으로 돌린 결과) >

(venv-py3.9) kcloud@k8s-worker2:~/yolov7/yolov7-py39$ python furiosa_eval.py --dfg_path=./yolov7.dfg --eval_data_path=./images/test --output_path=./output
/home/kcloud/yolov7/venv-py3.9/lib/python3.9/site-packages/furiosa/runtime/session.py:8: FutureWarning: 'furiosa.runtime.session' module is deprecated and will be removed in a future release.
  warnings.warn(
2025-08-12T02:12:03.089648Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
2025-08-12T02:12:03.096996Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2025-08-12T02:12:03.097024Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2025-08-12T02:12:03.097036Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
2025-08-12T02:12:03.123439Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:0-1 (warboy-b0-2pe, 128dpes, firmware: 1.7.7, 386a8ab)
2025-08-12T02:12:03.123639Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2025-08-12T02:12:03.127984Z  INFO furiosa::runtime: Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250812021203-krapbo.log
2025-08-12T02:12:03.236538Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-ffe85ccd using npu:0:0-1
2025-08-12T02:12:03.263574Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-ffe85ccd] compiling the model (target: warboy-b0-2pe, 128dpes, file: yolov7.dfg, size: 140.9 MiB)
[1/6] 🔍   Compiling from onnx to dfg
Done in 1.778151s
[2/6] 🔍   Compiling from dfg to ldfg
▪▪▪▪▪ [1/3] Splitting graph(LAS)...Done in 154.73363s
▪▪▪▪▪ [2/3] Lowering graph(LAS)...Done in 241.58595s
▪▪▪▪▪ [3/3] Optimizing graph...Done in 18.186304s
Done in 414.94238s
[3/6] 🔍   Compiling from ldfg to cdfg
Done in 0.017668756s
[4/6] 🔍   Compiling from cdfg to gir
Done in 0.18591064s
[5/6] 🔍   Compiling from gir to lir
▪▪▪▪▪ [1/3] Optimizing instruction scheduling...Done in 279.8947s
▪▪▪▪▪ [2/3] Trying to pin weights...Done in 22.396442s
▪▪▪▪▪ [3/3] Optimizing instruction scheduling and memory allocation via GA...Done in 0.000251736s
Done in 302.35553s
[6/6] 🔍   Compiling from lir to enf
Done in 4.5621643s
✨  Finished in 723.84186s

2025-08-12T02:24:10.376616Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-ffe85ccd] the model compile is successful (took 727 secs)
2025-08-12T02:24:10.520872Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 1 NPU threads on npu:0:0-1 (DRAM: 45.3 MiB/16.0 GiB, SRAM: 32.0 MiB/128.0 MiB)

Evaluating: 100%|████████████████████| 10/10 [00:00<00:00, 11.05image/s]
2025-08-12T02:24:11.467437Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-ffe85ccd] terminated
2025-08-12T02:24:11.744027Z  INFO furiosa_rt_core::npu::raw: NPU (npu:0:0-1) has been closed
2025-08-12T02:24:11.748777Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] stopped
Completed Evaluation
```  

### 결과분석 

- DFG(정량화 그래프)를 ENF(실행 바이너리)로 변환하는 단계
- 첫 실행에만 길게 걸리며, 이후에는 캐시를 재사용해 거의 즉시 실행 될 것임

```shell
compiling the model (target: warboy-b0-2pe, file: yolov7.dfg, size: 140.9 MiB)
[1/6] onnx → dfg
[2/6] dfg → ldfg (Splitting / Lowering / Optimizing)
[3/6] ldfg → cdfg
[4/6] cdfg → gir
[5/6] gir → lir (스케줄링·메모리 최적화)
[6/6] lir → enf
Finished in 723.84s (≈ 12분)
```  

- 실행 준비 완료, 메모리 사용량 정상 범위 할당  

```shell
created 1 NPU threads on npu:0:0-1 (DRAM: 45.3 MiB/16.0 GiB, SRAM: 32.0 MiB/128.0 MiB)
```  

- 평가(추론)

```shell
Evaluating: 100% ... 10/10 [ ... , 11.05 image/s]
```  

- 결과 (output 폴더에 추론 결과 이미지 생성)

```shell
(venv) kcloud@k8s-worker2:~/yolov7-furiosa/yolov7/output$ ls
1.jpg  2.jpg  3.jpg  4.jpg  5.jpg  7.jpg  9.jpg
```

![warboy_yolov7_output_01](./assets/image/warboy_yolov7_output_01.jpg)  

![warboy_yolov7_output_02](./assets/image/warboy_yolov7_output_02.jpg)



### furiosa_eval.py 코드 업데이트

NVIDIA GPU와 성능 비교를 위해, 기존 코드를 수정한다.  

- 입력데이터: 해당 디렉토리의 모든 이미지(정렬) 사용 ➡️ 샘플을 동일하게 하기 위함
- 전처리/후처리: `load_input/load_output/non_max_suppression/draw_bbox` 공유 
- 워밍업: `--warmup` 값 동일 설정
- 측정 구간: `infer-only`와 `E2E(저장제외)`를 동시에 출력

`furiosa_eval_all.py`

```python
import argparse
import os
import json
from statistics import mean, median
from time import perf_counter

import numpy as np
import cv2
from tqdm import tqdm

from utils.preprocess import load_input
from utils.postprocess import load_output, non_max_suppression, draw_bbox

import furiosa.runtime.session

INPUT_SHAPE = (640, 640)
IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp")

def list_images(img_dir):
    names = [n for n in os.listdir(img_dir) if n.lower().endswith(IMG_EXTS)]
    names.sort()
    return names

def summarize(arr):
    if not arr: 
        return {}
    arr_sorted = sorted(arr)
    return {
        "avg": mean(arr),
        "p50": median(arr),
        "p90": arr_sorted[int(0.90 * len(arr)) - 1] if len(arr) >= 10 else None,
        "p99": arr_sorted[int(0.99 * len(arr)) - 1] if len(arr) >= 100 else None,
    }

def main():
    args = build_argument_parser()

    dfg_path       = args.dfg_path
    conf_thres     = args.conf_thres
    iou_thres      = args.iou_thres
    eval_data_path = args.eval_data_path
    output_path    = args.output_path
    warmup         = args.warmup
    save_vis       = not args.no_save

    image_names = list_images(eval_data_path)
    if not image_names:
        raise RuntimeError(f"No images with {IMG_EXTS} under {eval_data_path}")

    if not os.path.isdir(output_path):
        os.makedirs(output_path)

    print(f"[1/5] 🔍 Loading DFG: {dfg_path}")
    lat_infer_ms = []
    lat_e2e_ms   = []

    with furiosa.runtime.session.create(dfg_path) as session:
        print(f"[2/5] 🔧 Warmup x{warmup} ...")
        warm_img_path = os.path.join(eval_data_path, image_names[0])
        warm_img, _ = load_input(warm_img_path, new_shape=INPUT_SHAPE)
        for _ in range(max(0, warmup)):
            _ = session.run([warm_img]).numpy()
        print(" Warmup complete.")

        print("[3/5] 🚀 Inference running (measure infer-only & E2E)...")
        for image_name in tqdm(image_names, desc="Evaluating (Warboy)", unit="image", mininterval=0.5):
            image_path = os.path.join(eval_data_path, image_name)

            t_e2e0 = perf_counter()
            img, preproc_param = load_input(image_path, new_shape=INPUT_SHAPE)

            # infer-only
            t0 = perf_counter()
            outputs = session.run([img]).numpy()
            t1 = perf_counter()

            # 디코딩 + NMS (A30와 동일 경로)
            outputs = load_output(outputs)
            outputs = non_max_suppression(
                outputs,
                conf_thres=conf_thres,
                iou_thres=iou_thres,
                agnostic=False,
                max_det=300,
            )

            t_e2e1 = perf_counter()
            lat_infer_ms.append((t1 - t0) * 1000.0)
            lat_e2e_ms.append((t_e2e1 - t_e2e0) * 1000.0)

            assert len(outputs) == 1, f"{len(outputs)=}"
            predictions = outputs[0]
            if predictions is None or predictions.shape[0] == 0:
                continue

            if save_vis:
                bboxed_img = draw_bbox(image_path, predictions, preproc_param)
                cv2.imwrite(os.path.join(output_path, image_name), bboxed_img)

    print("[4/5]  Inference complete. Summary:")
    summary = {
        "device": "Warboy-NPU",
        "images": len(image_names),
        "infer_ms": summarize(lat_infer_ms),
        "e2e_ms_no_save": summarize(lat_e2e_ms),
    }
    print(json.dumps(summary, indent=2))

    print(f"[5/5]  Completed Evaluation. Results saved to: {output_path} (save_vis={save_vis})")

def build_argument_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dfg_path", type=str, default="Result.dfg", help="Path to dfg file")
    parser.add_argument("--eval_data_path", type=str, default="./images/test", help="Dir of images (all files)")
    parser.add_argument("--conf_thres", type=float, default=0.65)
    parser.add_argument("--iou_thres", type=float, default=0.35)
    parser.add_argument("--output_path", type=str, default="./output", help="Dir to save results")
    parser.add_argument("--warmup", type=int, default=20, help="Warmup iterations before timing")
    parser.add_argument("--no_save", action="store_true", help="Do not save visualized outputs")
    args = parser.parse_args()
    return args

if __name__ == "__main__":
    main()
```  

### furiosa_eval.py 코드 실행 및 결과

```shell
python furiosa_eval_all.py \
  --dfg_path=./yolov7.dfg \
  --eval_data_path=./images/test \
  --output_path=./output_warboy \
  --conf_thres=0.65 \
  --iou_thres=0.35 \
  --warmup=20
```

📗 설정 관련  

- `conf_thres` = confidence threshold (신뢰도 임계값)  
    - 모델이 “이건 사람이다!” “이건 강아지다!”라고 판단하는 확신 정도가 0~1 사이 점수로 나옴  
    - 0.65 → 65% 이상 확신이 없으면 그냥 버림  
    - 예) 모델이 강아지라고 40%만 확신하면 “그건 버리자”는 뜻.  
- `iou_thres` = Intersection over Union threshold (겹침 정도 임계값)  
    - 두 박스가 얼마나 겹치는지 비율로 계산하는 값.  
    - 1.0 → 완벽히 겹침  
    - 0.0 → 아예 안 겹침  
    - 0.35 → 35% 이상 겹치면 중복이라고 판단해서 작은 점수 박스를 버림  

```shell
##-- 실행 결과 >
(venv) kcloud@k8s-worker2:~/yolov7-furiosa/yolov7$ python furiosa_eval_all.py \
  --dfg_path=./yolov7.dfg \
  --eval_data_path=./images/test \
  --output_path=./output_warboy \
  --conf_thres=0.65 \
  --iou_thres=0.35 \
  --warmup=20
/home/kcloud/yolov7-furiosa/venv/lib/python3.10/site-packages/furiosa/runtime/session.py:8: FutureWarning: 'furiosa.runtime.session' module is deprecated and will be removed in a future release.
  warnings.warn(
[1/5] 🔍 Loading DFG: ./yolov7.dfg
2025-08-14T07:05:47.707748Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
2025-08-14T07:05:47.715089Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2025-08-14T07:05:47.715116Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2025-08-14T07:05:47.715140Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
2025-08-14T07:05:47.742133Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:0-1 (warboy-b0-2pe, 128dpes, firmware: 1.7.7, 386a8ab)
2025-08-14T07:05:47.742330Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2025-08-14T07:05:47.742503Z  INFO furiosa::runtime: Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250814070547-fximv3.log
2025-08-14T07:05:47.852476Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-530ac332 using npu:0:0-1
2025-08-14T07:05:47.882148Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-530ac332] compiling the model (target: warboy-b0-2pe, 128dpes, file: yolov7.dfg, size: 140.9 MiB)
2025-08-14T07:05:50.362677Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-530ac332] the model compile is successful (took 2 secs)
2025-08-14T07:05:50.500430Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 1 NPU threads on npu:0:0-1 (DRAM: 45.3 MiB/16.0 GiB, SRAM: 32.0 MiB/128.0 MiB)
[2/5] 🔧 Warmup x20 ...
 Warmup complete.
[3/5] 🚀 Inference running (measure infer-only & E2E)...
Evaluating (Warboy): 100%|██████████████████| 10/10 [00:00<00:00, 11.30image/s]
2025-08-14T07:05:52.489169Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-530ac332] terminated
2025-08-14T07:05:52.760650Z  INFO furiosa_rt_core::npu::raw: NPU (npu:0:0-1) has been closed
2025-08-14T07:05:52.765297Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] stopped
[4/5]  Inference complete. Summary:
{
  "device": "Warboy-NPU",
  "images": 10,
  "infer_ms": {
    "avg": 51.36807599919848,
    "p50": 49.84037249960238,
    "p90": 55.936664997716434,
    "p99": null
  },
  "e2e_ms_no_save": {
    "avg": 79.81831259967294,
    "p50": 74.9643745002686,
    "p90": 82.01509399805218,
    "p99": null
  }
}
[5/5]  Completed Evaluation. Results saved to: ./output_warboy (save_vis=True)
```

📗 수치 해석  

- `infer_ms`: 추론(infer-only) 시간 통계. session.run() 호출 구간만 측정.  
    - NPU/GPU 순수 추론 코어 성능 비교용  
    - Latency(ms/image) 얼마나 빨리 한 장을 처리  
    - 📙 avg: 평균 지연시간(ms) = 51.36 ms/이미지   
        - 한 장의 이미지를 평균 0.051 초에 처리한다는 뜻
        - 이것의 역수는 19.6 image/s = 처리율 (1초에 몇 장을 처리)
    - p50: 중앙값 = 49.84 ms (절반은 이 값 이하)  
    - p90: 상위 10% 경계 = 55.93 ms (상위 10%만 이보다 느림)  
    - p99: 표본이 100 미만이라 null (계산하지 않음)  
- `e2e_ms_no_save`: E2E(전처리→추론→후처리/NMS, 저장 제외) 시간 통계.  
    - 전처리/후처리 포함 실제 파이프라인 성능 비교  
    - 전처리(이미지 읽기, 리사이즈, 정규화), 훠리(NMS, 좌표 변환, 시각화)  
    - avg: 79.81 ms/이미지  
        - 📙 처리율로는 12.5 img/s (위의 기본 Warboy-Yolov7 와 유사)  
    - p50: 74.96 ms  
    - p90: 82.01 ms  
    - p99: null (표본 부족)  


## 3.2 NVIDIA A30 (Yolov7)

### 사전 환경

```shell
cd ~/yolov7-furiosa/
source venv/bin/activate
cd yolov7

##-- (venv) >
pip install onnxruntime-gpu==1.17.0 opencv-python numpy

cd /tmp
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt-get update
sudo apt-get install -y cuda-runtime-11-8 \
    libcufft-11-8 libcurand-11-8 libcublas-11-8 libcusolver-11-8 libcusparse-11-8

sudo ldconfig
ldconfig -p | grep -E 'libcufft.so.10|libcurand.so.10|libcublas.so.11'

cd ~/yolov7-furiosa/yolov7
``` 

### 검증 파일 생성

`https://github.com/furiosa-ai/yolov7`에서 제공하는 `furiosa_eval.py`, 앞서 생성한 `furiosa_eval_all.py`를 참조하여 NVIDIA 용으로 구현

```shell
vim ~/yolov7-furiosa/yolov7/a30_eval_onnx_all.py
```

`a30_eval_onnx_all.py`

```python
import argparse
import os
import json
from statistics import mean, median
from time import perf_counter

import numpy as np
import cv2
import onnxruntime as ort
from tqdm import tqdm

from utils.preprocess import load_input
from utils.postprocess import load_output, non_max_suppression, draw_bbox

INPUT_SHAPE = (640, 640)
IMG_EXTS = (".jpg", ".jpeg", ".png", ".bmp")

def list_images(img_dir):
    names = [n for n in os.listdir(img_dir) if n.lower().endswith(IMG_EXTS)]
    names.sort()
    return names

def summarize(arr):
    if not arr: 
        return {}
    arr_sorted = sorted(arr)
    return {
        "avg": mean(arr),
        "p50": median(arr),
        "p90": arr_sorted[int(0.90 * len(arr)) - 1] if len(arr) >= 10 else None,
        "p99": arr_sorted[int(0.99 * len(arr)) - 1] if len(arr) >= 100 else None,
    }

def main():
    args = build_argument_parser().parse_args()

    onnx_path     = args.onnx_path
    eval_data_dir = args.eval_data_path
    conf_thres    = args.conf_thres
    iou_thres     = args.iou_thres
    output_dir    = args.output_path
    input_name    = args.input_name
    warmup        = args.warmup
    save_vis      = not args.no_save

    os.makedirs(output_dir, exist_ok=True)

    print(f"[1/5] 🔍 Loading ONNX model from {onnx_path} ...")
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    sess = ort.InferenceSession(onnx_path, providers=providers)
    in_name = input_name or sess.get_inputs()[0].name
    print(f" Providers: {sess.get_providers()} | Input: {in_name}")

    print(f"[2/5] 📂 Scanning images in: {eval_data_dir}")
    image_names = list_images(eval_data_dir)
    if not image_names:
        raise RuntimeError(f"No images with {IMG_EXTS} under {eval_data_dir}")
    print(f" Found {len(image_names)} images.")

    print(f"[3/5] 🔧 Warmup x{warmup} ...")
    warm_img_path = os.path.join(eval_data_dir, image_names[0])
    warm_img, _ = load_input(warm_img_path, new_shape=INPUT_SHAPE)
    for _ in range(max(0, warmup)):
        _ = sess.run(None, {in_name: warm_img})
    print(" Warmup complete.")

    print("[4/5] 🚀 Inference running (measure infer-only & E2E)...")
    lat_infer_ms = []  # sess.run()만
    lat_e2e_ms   = []  # 전처리~후처리(저장 제외)

    for image_name in tqdm(image_names, desc="Evaluating (A30-ORT)", unit="image", mininterval=0.5):
        image_path = os.path.join(eval_data_dir, image_name)

        t_e2e0 = perf_counter()
        # 전처리
        img, preproc_param = load_input(image_path, new_shape=INPUT_SHAPE)

        # 추론 (infer-only)
        t0 = perf_counter()
        ort_outs = sess.run(None, {in_name: img})
        t1 = perf_counter()

        # 출력 해석: 2D/3D(디코딩 완료) vs 4D(feature map)
        predictions_list = []
        pred_array = np.array(ort_outs[0])
        if pred_array.ndim == 2:
            pred_array = np.expand_dims(pred_array, axis=0)  # (1, N, 85)
        if pred_array.ndim == 3 and pred_array.shape[-1] >= 6:
            for b in range(pred_array.shape[0]):
                predictions_list.append(pred_array[b])
        else:
            decoded = load_output(ort_outs)  # list[(N,85)]
            predictions_list.extend(decoded)

        predictions_array = np.array(predictions_list)  # (B, N, 85)
        outputs = non_max_suppression(
            predictions_array,
            conf_thres=conf_thres,
            iou_thres=iou_thres,
            agnostic=False,
            max_det=300,
        )

        # E2E 측정(저장 제외)
        t_e2e1 = perf_counter()
        lat_infer_ms.append((t1 - t0) * 1000.0)
        lat_e2e_ms.append((t_e2e1 - t_e2e0) * 1000.0)

        # 시각화 저장 (측정에서 제외)
        if outputs and len(outputs) == 1:
            predictions = outputs[0]
            if predictions is not None and predictions.shape[0] > 0 and save_vis:
                vis = draw_bbox(image_path, predictions, preproc_param)
                cv2.imwrite(os.path.join(output_dir, image_name), vis)

    print("[5/5]  Inference complete. Summary:")
    summary = {
        "device": "A30-ORT-CUDA",
        "images": len(image_names),
        "infer_ms": summarize(lat_infer_ms),
        "e2e_ms_no_save": summarize(lat_e2e_ms),
    }
    print(json.dumps(summary, indent=2))
    print(f" Completed. Results saved to: {output_dir} (save_vis={save_vis})")

def build_argument_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx_path", type=str, default="./yolov7.onnx", help="Path to ONNX model")
    parser.add_argument("--eval_data_path", type=str, default="./images/test", help="Dir of images (all files)")
    parser.add_argument("--conf_thres", type=float, default=0.65)
    parser.add_argument("--iou_thres", type=float, default=0.35)
    parser.add_argument("--output_path", type=str, default="./output_a30", help="Dir to save results")
    parser.add_argument("--input_name", type=str, default="images", help="ONNX input name (export-time)")
    parser.add_argument("--warmup", type=int, default=20, help="Warmup iterations before timing")
    parser.add_argument("--no_save", action="store_true", help="Do not save visualized outputs")
    return parser

if __name__ == "__main__":
    main()
```

### 평가

```shell
python a30_eval_onnx_all.py \
  --onnx_path=./yolov7.onnx \
  --eval_data_path=./images/test \
  --output_path=./output_a30 \
  --conf_thres=0.65 \
  --iou_thres=0.35 \
  --warmup=20
```  

### 결과분석

```shell
(venv) kcloud@k8s-worker2:~/yolov7-furiosa/yolov7$  python a30_eval_onnx_all.py \
  --onnx_path=./yolov7.onnx \
  --eval_data_path=./images/test \
  --output_path=./output_a30 \
  --conf_thres=0.65 \
  --iou_thres=0.35 \
  --warmup=20
[1/5] 🔍 Loading ONNX model from ./yolov7.onnx ...
 Providers: ['CUDAExecutionProvider', 'CPUExecutionProvider'] | Input: images
[2/5] 📂 Scanning images in: ./images/test
 Found 10 images.
[3/5] 🔧 Warmup x20 ...
 Warmup complete.
[4/5] 🚀 Inference running (measure infer-only & E2E)...
Evaluating (A30-ORT): 100%|██████████████| 10/10 [00:00<00:00, 25.88image/s]
[5/5]  Inference complete. Summary:
{
  "device": "A30-ORT-CUDA",
  "images": 10,
  "infer_ms": {
    "avg": 20.01717169623589,
    "p50": 18.96103699982632,
    "p90": 23.068080001394264,
    "p99": null
  },
  "e2e_ms_no_save": {
    "avg": 33.0079682986252,
    "p50": 28.440210000553634,
    "p90": 38.668622000841424,
    "p99": null
  }
}
 Completed. Results saved to: ./output_a30 (save_vis=True)
```  


## 3.3 Warboy, A30 (Yolov7) 결과 분석 및 한계

📗 Warboy  

- ONNX 범용 모델  
- 양자화로 INT8 변환 (모델 사이즈 축소 + 정수 연산 최적화)  
- 컴파일(DFG 생성) ➡️ NPU 전용 명령어로 변환  
- 런타임 실행 (Furiosa Runtime)  

📗 A30  

- ONNX 범용 모델  
- ONNX Runtime (CUDAExecutionProvider)  
    - GPU에서 FP16, FP32 연산  
    - 특히 ONNX Runtime에서 CUDAExecutionProvider를 사용할 경우 FP16 최적화가 자동 적용  
- 모델 변환 없이 그대로 실행함 (양자화 X)  

📕 `A30은 FP16·FP32 연산에 특화된 Tensor Core 덕분에, Warboy보다 동일 해상도에서 2.5배 이상 빠른 추론 속도를 달성했다`    


[model yolov7] : conf (0.65), iou (0.35)

| metrics          | Warboy-NPU (ms/image) | A30-ORT-CUDA (ms/image) |
| ---------------- | ---------------------- | ------------------------ |
| images           | 10                     | 10                       |
| infer_ms_avg     | 51.37                  | 20.02                    |
| infer_ms_p50     | 49.84                  | 18.96                    |
| infer_ms_p90     | 55.94                  | 23.07                    |
| infer_ms_p99     | N/A                    | N/A                      |
| e2e_ms_avg       | 79.82                  | 33.01                    |
| e2e_ms_p50       | 74.96                  | 28.44                    |
| e2e_ms_p90       | 82.02                  | 38.67                    |
| e2e_ms_p99       | N/A                    | N/A                      |

📕 image/s라면?  

[model yolov7] : conf (0.65), iou (0.35)

| metrics        | Warboy-NPU (image/s) | A30-ORT-CUDA (image/s) |
| -------------- | -------------------- | ----------------------- |
| images         | 10                   | 10                      |
| infer_avg      | 19.47                | 49.95                   |
| infer_p50      | 20.07                | 52.76                   |
| infer_p90      | 17.87                | 43.35                   |
| infer_p99      | N/A                  | N/A                     |
| e2e_avg        | 12.53                | 30.29                   |
| e2e_p50        | 13.34                | 35.16                   |
| e2e_p90        | 12.19                | 25.85                   |
| e2e_p99        | N/A                  | N/A                     |


📗 추가하면 좋을 비교 항목

- 정확도(mAP) 비교 관련  
    - 지금 두 스크립트는 JSON을 저장해 mAP 계산을 하는 로직이 없음(요약 통계/시각화 위주). → 속도 비교는 가능, 정확도 비교는 불가.  
    - 추론 결과를 detections JSON으로 저장하고, pycocotools로 mAP@0.5 / @0.5:0.95 평가를 동일하게 수행. (클래스 ID 매핑 주의)  

- 전력(FPS/W)  
    - A30: nvidia-smi --query-gpu=timestamp,power.draw --format=csv -l 1 동시 수집.  
    - Warboy: furiosa-smi 유틸로 전력/온도 등 수집. (동일 시간창에서 평균 전력 산출)
    - 결과를 합쳐 FPS/W 계산.  
--- 
