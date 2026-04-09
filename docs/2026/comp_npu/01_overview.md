# 1. 개요: GPU VS NPU

## 1.1 비교군

보유 모델  

- Furiosa Warboy, NVIDIA A30, A2  
    - Sparsity 미적용 기준    

- Sparsity?  
    - NVIDIA Ampere/Ada 아키텍처 GPU는 Sparse Tensor Core 기능을 제공  
    - 이는 행렬 곱셈에서 일정한 패턴으로 0 값을 건너뛰는 방식  
    - 연산량을 절반으로 줄이면서 동일한 결과를 낼 수 있게 함  
    - 연산을 50%만 해도 결과 정확도를 유지할 수 있기 때문에, 최대 2배 속도 향상을 달성 가능  

| 모델 | 주 용도 | INT8 성능 | FP16 성능 | TF32 성능 | FP32 성능 | 메모리 / 대역폭 | 소비 전력(TDP) | 가격 (참고) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **FuriosaAI Warboy** | 비전 추론, 엣지/온프렘 NPU | 64 TOPS | – | – | – | LPDDR4x 16GB / 66 GB/s | 40–60W | 약 ₩3,232,000 |
| **NVIDIA A2** | 엔트리 추론, IVA | 36 TOPS | 18 TF | 9 TF | 4.5 TF | GDDR6 16GB / 200 GB/s | 40–60W | 약 ₩1,304,000 |
| **NVIDIA A30** | 엔터프라이즈 추론 + HPC | 330 TOPS | 165 TF | 82 TF | 10.3 TF | HBM2 24GB / 933 GB/s | 165W | 약 ₩7,200,000 |
| **NVIDIA L40S** | 생성형 AI, LLM 추론·학습, 3D/미디어 | (INT8 별도 미표기, FP8 중심) | 733 TF | 366 TF | 91.6 TF | GDDR6 48GB / 864 GB/s | 350W | 약 ₩11,700,000 |


## 1.2 동일 구성 요소

| 항목 | 설명 |
|------|-----|
| 모델 버전 | 동일한 모델 구조 및 가중치 사용 <br> (예: YOLOv5s / YOLOv7 / YOLOv8 등) |
| 프레임워크/런타임 | 동일한 추론 프레임워크 및 버전 사용 <br> (예: ONNX Runtime, TensorRT, FuriosaAI SDK 등) |
| 입력 데이터 | 고정된 입력 이미지 세트 사용 <br> (예: COCO validation 100장 등), 전처리 방식 동일 적용 |
| 배치 크기 | Batch size를 동일하게 설정 <br> (예: 1, 4, 8) 인퍼런스 지연 시간 vs 처리율 측정 목적에 따라 선택 |
| 리소스 요청/할당량 | Pod 리소스(CPU, Memory, GPU/NPU) 제한 및 요청값 동일 설정 |
| K8s 스케줄링 조건 | Node Affinity 또는 Node Selector를 사용해 동일한 조건의 노드에 스케줄링 |
| 컨테이너 베이스 이미지 | 동일한 OS 및 라이브러리 기반 이미지 사용 <br> (예: Ubuntu 20.04, Python 3.8 등) |
| 환경 변수 / 최적화 설정 | OpenMP, NUMA, Thread 수, Pinning, 메모리 관리 설정 등을 동일하게 유지 |
| 전력 관리 설정 | GPU/NPU 전력 제한(Power Limit) 및 클럭 설정 동일하게 적용 |
| 부하/혼잡 조건 | 독립된 노드에서 측정하거나, 동일한 백그라운드 부하 상태에서 측정 |

📕 단, Furiosa Warboy는 전용 컴파일러/런타임(FuriosaRT)로 실행되도록 설계되어 있어 GPU처럼 같은 런타임을 사용하기 어려움

## 1.3 실험 방법 고려

| 관점 | 실험 방법 | 장점 | 단점 |
|------|----------|------|-----|
| ① 완전 동일 조건 비교 | Warboy와 A30 모두 동일 프레임워크(예: ONNX Runtime)로 실행 | 모델 변환·최적화 차이 없이 순수 하드웨어+런타임 차이만 측정 가능 | 각 하드웨어의 최적 성능이 안 나올 수 있음 |
| ② 각 하드웨어의 “최적 성능” 비교 | Warboy → Furiosa SDK / ENF 변환<br>A30 → TensorRT 엔진 변환 | 실제 제품 사용 시 기대 성능 비교 가능 | 런타임 최적화 방식이 달라서 “절대 공정”은 아님 |

📗 즉 하드웨어 자체 성능을 순수하게 비교하고 싶으면 ① 방식
📗 사용자가 실제 쓸 때의 속도를 보고 싶으면 ② 방식

- 실제 AI 가속기 비교 벤치마크에서는 보통 ② 방식 사용
    - 현실에서는 누구도 `최적화 안 된` ONNX를 그대로 돌리지 않기 때문
- 논문이나 기술 검증 목적으로 `동일 조건`만 보려면 ① 방식이 더 적합함

📗 ② 방식 수행 과정 (Warboy, NVIDIA GPU) 

```shell
[1] 모델 준비
    └─ PyTorch (YOLOv9m) → 학습된 weights.pt

[2] ONNX 변환
    └─ PyTorch → ONNX (범용 모델 포맷)

[3] INT8 변환 (Quantization)
    ├─ Calibration Data (COCO val 일부 이미지)
    └─ Calibration Table 생성

[4] 하드웨어별 최적화
    ├─ Warboy → Furiosa SDK → ENF 포맷
    └─ A30    → TensorRT → Engine 파일

[5] 추론 실행
    ├─ 동일 이미지(COCO val)
    ├─ 동일 Batch size, Input size
    ├─ NMS (외부, 동일 파라미터)
    └─ Latency, FPS, Power 측정

[6] 정확도 평가
    └─ 추론 결과(JSON) → COCO 평가 스크립트 → mAP 산출

[7] 결과 비교
    ├─ 속도(FPS)
    ├─ 정확도(mAP)
    └─ 전력 효율(FPS/Watt)
```

## 1.4 측정 항목 (Inference)

| 측정 항목 | 설명 |
|----------|------|
| Latency (지연 시간) | 이미지 1장을 처리하는 데 걸리는 시간(ms). <br> 평균, 최솟값, 최댓값, 99퍼센타일(Percentile) 등을 측정 |
| Throughput (처리율) | 초당 처리 가능한 이미지 수(images/sec). <br> 주로 batch size가 1보다 큰 경우 유용 |
| Resource Utilization | CPU 사용량, GPU/NPU 사용량, 메모리 사용량(RAM 또는 VRAM) <br> nvidia-smi, furiosa-smi, exporter 등으로 측정 |
| Power Consumption | 노드 또는 디바이스의 전력 사용량(W) <br> 실험 환경에서 측정 가능할 경우 포함 |
| Accuracy (선택) | 모델 최적화 전후의 정확도 변화 확인 <br> YOLO의 경우 mAP@.5, 분류 모델은 Accuracy 등을 사용 |

### 측정 값 예

```shell
##-- 결과 예 >
Inference Done in 68.93 sec
{
  "model": "../models/enf/object_detection/yolov9t.enf",
  "cfg": "tutorials/cfg/yolov9t.yaml",
  "images": 5000,
  "throughput_img_per_s": {
    "e2e": 4.789169679119893,
    "infer_only": 4.912782705593637
  },
  "latency_ms": {
    "pre": {
      "avg": 0.7833296074328245,
      "p50": 0.7361555035458878,
      "p90": 1.168547009001486,
      "p99": 1.3575250050053
    },
    "infer": {
      "avg": 203.55062699219562,
      "p50": 195.31430400093086,
      "p90": 224.6619659999851,
      "p99": 467.8322520048823
    },
    "post": {
      "avg": 4.469821264912025,
      "p50": 4.218457994284108,
      "p90": 5.363285992643796,
      "p99": 7.884419013862498
    },
    "e2e": {
      "avg": 208.8044623601163,
      "p50": 200.50756000273395,
      "p90": 229.99187199457083,
      "p99": 473.375675996067
    }
  }
}
Loading and preparing results...
DONE (t=3.47s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=47.38s).
Accumulating evaluation results...
DONE (t=8.22s).
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

`inference Done in 68.93 sec`  

- 실험이 5,000장 (coco/val2017)을 가정, 이 파일들을 추론 완료하는데 걸린 시간
- 68.93초 동안 5,000장 → 초당 약 72.6장 추론 (뒤의 throughput 계산과 동일한 의미)

`throughput`: (이미지/초) 초당 몇 장의 이미지를 처리할 수 있는지  

- `e2e`: 전처리(pre) + 추론(infer) + 후처리(post) 전체 포함
- `infer_only`: 모델 추론(inference) 단계만.
- 위 결과에는 초당 약 4.8~5장 처리 가능

`latency_ms`: 이미지 1장을 처리하는 데 걸리는 시간  

- pre: 전처리(이미지를 Tensor로 변환 등).
- infer: 순수 추론 시간 (YOLOv9 모델 실행).
- post: 후처리(NMS, 박스 필터링 등).
- e2e: 전체 end-to-end 시간 (pre + infer + post).
<br>
- `avg`: 평균값.
- `p50`: 50% 지점(중앙값).
- `p90`: 90% 지점(상위 10% 느린 경우)
- `p99`: 99% 지점(가장 느린 꼬리 분포)

`Average Precision (AP)`: 객체 탐지에서 정밀도와 재현율 곡선의 평균 값  

- `IoU=0.50:0.95`: IoU 임계 값을 0.5~0.94까지 변화시키며 평균한 값  
    - `AP@[IoU=0.50:0.95 | area=all]` = 0.356 → 최종 mAP  
    - `AP@[IoU=0.50]` = 0.499 → IoU=0.5에서만 측정 (일반적인 정확도)  
    - `AP@[IoU=0.75]` = 0.383 → 더 엄격한 IoU=0.75에서 평가  
    - `AP@[small/medium/large]` → 작은/중간/큰 객체에 대한 성능  




## 1.5 Warboy의 Inference 수행 과정

<u>**Furiosa Warboy에 대한 Inference 수행은 아래와 같은 순서로 진행된다.**</u>

![warboy_service_process](./assets/image/warboy_service_process.png)

DL Framework ➡️ Export ONNX ➡️ ONNX Graph ➡️ Furiosa Quantizer / Calibrator ➡️ ONNX Graph (8bit integer) ➡️ Furiosa Compiler ➡️ Warboy ISA (Device Runtime) 

① DL Framework  

- PyTorch, TensorFlow 같은 모델 학습/실행 프레임워크
- 여기서 모델을 학습하거나, 이미 학습된 `.pt`(PyTorch)나 `.pb`(TensorFlow) 모델을 불러옴

② ONNX (Open Neural Network Exchange) AI 모델의 중립 포맷  

- PyTorch/TensorFlow 모델을 공용 구조로 변환 ➡️ 다른 툴이나 하드웨어에서도 읽을 수 있게 함

③ ONNX Graph  

- `.onnx` 파일 안에는 모델의 계산 그래프가 저장됨
- 그래프 : 레이어(Conv, ReLU, Pooling…)와 데이터 흐름(텐서)이 노드-엣지 구조로 표현됨
- 이 상태는 여전히 float32 연산 기반.

④ Furiosa Quantizer / Calibrator  

- Furiosa Quantizer: float32 연산을 **int8(8bit)**로 변환하는 도구
- Calibrator: 변환 전에 Calibration 데이터셋을 통해 각 레이어의 값 범위를 분석해 스케일링 최적화
- 결과: 정수 기반의 ONNX 모델이 생성됨 (속도↑, 메모리↓)

⑤ ONNX Graph (8bit integer)  

- 이제 모든 연산이 8bit 정수 기반의 그래프 구조로 변경됨
- NPU에서 그대로 실행할 수 있는 형태에 가까워짐.
- 예: `yolov7_int8.onnx`

⑥ Furiosa Compiler  

- 정수형 ONNX를 **Warboy NPU가 이해하는 기계어(ISA)**로 변환
- 이때 NPU의 하드웨어 구조에 맞춰 연산 스케줄링, 메모리 배치, 병렬 처리 최적화 수행.
- 출력: `.enf` 또는 `.dfg` → NPU 실행 바이너리

⑦ Warboy ISA (Device Runtime)   

- `.enf` 파일을 NPU 드라이버(Runtime)에 로드 → 실시간 추론 수행
- Warboy ISA는 Warboy 칩 내부에서 동작하는 전용 명령어 집합
- CPU가 OS에서 실행하듯, Warboy는 ISA로 모델을 실행

📗 Warboy 한계

![warboy_limitations](./assets/image/warboy_limitations.png)


## 1.6 관련 용어 및 개념
 
### Yolo

YOLO (You Only Look Once), 객체 탐지(Object Detection)에서 활용하는 딥러닝 모델  

- One Stage 모델  
    - 다른 객체 탐지 모델(ex)R-CNN 계열)은 2단계 과정을 수행  
    - 후보 영역 추출 ➡️ 객체 분류  
    - Yolo는 하나의 네트워크에서 한 번에 객체의 위치와 종류를 예측  
- Grid 기반 예측  
    - 이미지를 여러 개의 셀(Grid)로 나누고 각 셀에서 객체의 위치와 클래스 정보를 예측  
- End-to-End 학습  
    - 처음부터 끝까지 하나의 네트워크에서 학습 진행  

<u>**Yolov9 (2024)** </u>  

- Paper: 🔗 [https://arxiv.org/abs/2402.13616](https://arxiv.org/abs/2402.13616)  
- Github: 🔗 [https://github.com/WongKinYiu/yolov9](https://github.com/WongKinYiu/yolov9)  

- 모델을 `T(Tiny), S(Small), M(Medium), C(Compact), E(Extra large)`으로 구분함  
    - 크기가 커질 수록 정확도 ↑, 속도 ↓   
    - T는 모바일/임베디드용  
    - E는 연구용, 서버/클라우드 배포  
    - converted는 Ultralytics YOLO 포맷과 호환형태로 매핑  

<u>**Yolov11 (2024)** </u>  

- Ultralytics Yolo  
    - 2018년 Yolov3 코드를 Pytorch로 재구현   
    - Pytorch 기반으로 `Ultralytics` 팀에서 YOLO11 까지 별도 개발  

### Darknet

주로 Yolo 모델을 구현한 오픈소스 딥러닝 프레임워크  

- 딥러닝 프레임워크: 컴퓨터가 스스로 학습할 수 있도록 돕는 소프트웨어
- Yolo 모델을 훈련시키거나 학습된 Yolo 모델을 실제

### CoCo

Object Detection 에서 주로 사용되는 모델 검증용 DataSet  

- 객체 탐지(Object Detection), 인스턴스 분할(Instance Segmentation), 키포인트(사람 포즈) 등 컴퓨터 비전을 연구/학습/평가하는 표준 벤치마크  
- 수십만 장의 이미지, 80개 이상의 일상 물체(사람, 자동차, 개, 컵 등), 복잡한 배경 속 물체를 많이 담음  

- (참조) 대표적인 데이터 셋  

    - ex) PASCAL VOC, MS COCO 

- Home: 🔗 [https://cocodataset.org/#home](https://cocodataset.org/#home)  


#### get_coco.sh

Yolo Repo.에 포함되어 있는 Coco Dataset 다운로드 스크립트  

- `get_coco.sh` 수행 결과  
    - `annotations/*.json`: COCO “원본” 라벨 포맷(이미지 ID, 바운딩박스, 카테고리 등).  
    - `labels/*/*.txt`: YOLO 학습용으로 변환된 라벨.  
        - 각 이미지에 대응하는 .txt 파일이 있고, 한 줄 = 하나의 바운딩박스 입니다.  
        - 형식: class_id x_center y_center width height (모두 0~1로 정규화된 비율)
    - `train2017.txt / val2017.txt`: YOLO 스크립트들이 바로 읽어 쓰기 편한 “이미지 경로 목록”.  

```shell
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

위 파일들은 두 가지 용도로 활용  

- 추론(실행)  
    - 공개된 COCO 학습 가중치(예: `yolov7.pt`)로 내 이미지/동영상에 대해 객체 탐지  
    - 이 경우 COCO “데이터 파일” 자체는 꼭 필요 없음 (가중치만 있으면 OK)  
    - 추론 결과를 비교할 때, 모델이 얼마나 잘 찾는지(mAP 점수)를 공통 기준으로 비교할 수 있음  
- 모델을 학습/미세튜닝(파인튜닝)  
    - COCO의 images/, labels/, train/val.txt를 이용해 YOLOv7을 훈련하거나 재학습합니다.  
    - COCO 전체로 학습하면 “일반 물체 80종”을 잘 잡는 범용 탐지기가 됩니다.  
    - 내 도메인(예: 특정 공장 부품, 특정 현장 물체)에 맞추려면 내 데이터를 동일한 구조로 만들어 파인튜닝  

### Kaggle

📕 사용 안함

데이터 사이언스, 머신러닝 관련 대회 플랫폼, 데이터셋 저장소, 코드 공유 허브    

데이터셋 다운로드는 가입 ➡️ API Token 발급 ➡️ Token 활용 다운로드 순으로 진행한다.  

- 계정 ➡️ settings ➡️ Create New Token  
    - 실행 하면, `kaggle.json` 파일 다운로드 됨  
    <br> 

    ![create_api_token](./assets/image/kaggle_create_api_token.png)   
    <br>  
    
    ![get_api_token](./assets/image/kaggle_get_api_token.png)   

```shell
mkdir -p ~/.kaggle
cp kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json

##-- 실행 예 >
kcloud@k8s-worker1:~/kaggle/api_eky$ ls
kaggle.json
kcloud@k8s-worker1:~/kaggle/api_eky$ mkdir -p ~/.kaggle
kcloud@k8s-worker1:~/kaggle/api_eky$ cp kaggle.json ~/.kaggle/
kcloud@k8s-worker1:~/kaggle/api_eky$ chmod 600 ~/.kaggle/kaggle.json
kcloud@k8s-worker1:~/kaggle/api_eky$
kcloud@k8s-worker1:~/kaggle/api_eky$ ll ~/.kaggle/
total 12
drwxrwxr-x 2 kcloud kcloud 4096 Aug 11 05:06 ./
drwxr-x--- 8 kcloud kcloud 4096 Aug 11 05:06 ../
-rw------- 1 kcloud kcloud   62 Aug 11 05:06 kaggle.json
```  

```shell
mkdir ~/kaggle
cd ~/kaggle

sudo apt install python3.10-venv -y
python3 -m venv venv
```

```shell
source venv/bin/activate

##-- (venv) >
pip install kaggle

kaggle datasets download sshikamaru/car-object-detection
```  

![kaggle_download_dataset](./assets/image/kaggle_download_dataset.png)

### Runtime

PyTorch, ONNX Runtime, TensorRT  

| 항목 | PyTorch | ONNX Runtime | TensorRT |
|------|---------|--------------|----------|
| 용도 | 학습 + 추론 (개발/연구용) | 추론 (범용) | 추론 (NVIDIA GPU 최적화) |
| 실행 속도 | 가장 느림 (연구/디버깅 최적화) | 빠름 (범용) | 가장 빠름 (GPU 최적화) |
| 하드웨어 지원 | CPU, GPU, NPU 등 | CPU, GPU, NPU 등 | NVIDIA GPU 전용 |
| 모델 형식 | PyTorch 전용(.pt) | ONNX(.onnx) | TensorRT Engine(.plan) |
| 추론 과정 | Python 코드 → PyTorch 커널 | ONNX → 백엔드 커널 호출 | ONNX → TensorRT 변환 → 최적화 실행 |

### 기타 용어

📗 텐서 (tensor)

수학적으로 `다차원 배열` 프로그래밍에서는 `Numpy 배열`이나 PyTorch Tensor 처럼 여러 차원(축)을 가진 데이터 구조  

- 스칼라(Scalar): 숫자 1개 (예: 7) → 0차원 텐서  
- 벡터(Vector): 숫자 여러 개 (예: [1,2,3]) → 1차원 텐서  
- 행렬(Matrix): 2차원 표 (예: [[1,2],[3,4]]) → 2차원 텐서  
- 3D 텐서: 여러 장의 행렬을 쌓은 것 (예: 영상의 RGB 채널, (3,H,W))  
- 4D 텐서: 여러 장의 이미지를 묶은 것 (batch of images, (N,3,H,W))  

이미지 처리에서의 텐서  

- 단일 이미지 (RGB)  
    - (3, H, W) → 3채널(R,G,B), 높이(H), 너비(W)  
- 배치(batch) 이미지  
    - (N, 3, H, W) → N장의 이미지가 묶인 4차원 배열  
        - N=32라면, 32장의 이미지가 하나의 큰 텐서에 들어 있음  


📗 가중치  

딥러닝 모델은 **수많은 숫자(파라미터)**로 구성    

- 처음엔 랜덤 값 → 학습을 하면서 데이터(이미지와 라벨)를 보고 숫자를 조금씩 조정
- 이 숫자들이 가중치(weight)  
- 이미지 속 패턴(색, 모양, 경계, 질감 등)을 인식하는 방법이 바로 이 가중치에 들어 있음  

`yolov7.pt`  

- .pt 확장자는 PyTorch에서 쓰는 모델 저장 형식  
- `yolov7.pt` = YOLOv7 모델 구조 + COCO 데이터셋으로 이미 학습된 가중치  
    - 모델 구조: `이 모델은 몇 개 층(layer)로 되어 있고, 어떻게 연결되어 있다` 라는 설계도  
    - 가중치 값: `각 층의 필터(커널) 값, 바이어스 값 등` ➡️ 이미지 속 물체를 잘 구분하도록 이미 튜닝된 숫자들  
- 즉, COCO 80종 물체를 잘 찾도록 이미 학습 완료된 뇌  


비유  

- 모델 구조: 카메라 본체  
- 가중치 파일: 카메라의 초점·렌즈 설정 값  
- 빈 카메라(랜덤 가중치)는 초점이 안 맞음 → 촬영하려면 한참 세팅해야 함  
-  yolov7.pt 카메라는 이미 초점이 맞춰져 있어서 바로 촬영 가능  


📗 정규화 (nomalization)  

픽셀을 모델이 다루기 좋은 범위로 스케일링하는 과정  

- 원본 이미지는 픽셀 값이 0~255 범위(정수)  
- 모델 학습/추론 시에는 **연속값(float)**으로 다루는게 좋기 때문에  
- 0~255를 0~1 의 값으로 변경한다  
    - 예) 원래 값 `[0, 128, 255]` → 정규화 후 `[0.0, 0.5, 1.0]`  


📗 배치사이즈 (batch Size)

한 번에 모델에 넣어 처리하는 이미지(샘플) 묶음의 크기  

- 배치사이즈 32: 32장의 이미지를 한 번에 처리  
- 배치가 클 수록 GPU 메모리 사용량 커짐  
- 배치를 키우면 초당 처리 이미지 수 (img/s, FPS (throughput))이 상승함  
- 배치를 키우면 지연시간(latency)가 길어져 (한 묶음을 끝내는 시간)  


📗 ONNX (Open Neural Network eXchanger)

모델을 다른 환경에서도 쓸 수 있게 변환한 범용 모델 포맷  

- `.onnx` 파일로 변경하면 Pytorch가 아닌 다른 프로그램 (TensorRT, Warboy 등)에서도 사용할 수 있다.

📗 양자화 (Quantization)

모델 안의 숫자를 작게 줄여(정밀도 낮춤) 속도를 높이고, 메모리 사용을 줄임  

FP32 → INT8  

- FP32: 32비트 실수 (정밀도 높음, 느림)  
- INT8: 8비트 정수 (정밀도 낮음, 빠름)  
- INT8로 바꾸면 계산량이 줄어서 속도가 빨라짐, 대신 정확도가 조금 떨어질 수 있음.  

대표 이미지(캘리브레이션 데이터)  

- INT8로 바꾸기 전에, 실제 데이터를 일부 보여줘서 숫자를 어떻게 줄일지 감을 잡게 하는 과정이 필요.  
- 이게 `캘리브레이션(calibration)`이고, 그 데이터가 `대표 이미지`  

📗 캘리브레이션 (Calibration)

학습된 모델을 8bit로 줄여도(양자화) 정확도가 크게 떨어지지 않게 만드는 `값 맞추기` 과정  

- 원래 딥러닝 모델은 **float32(소수점 32비트)**로 연산 → 크고 느림.  
- NPU 같은 AI 전용 칩은 8bit 정수로 계산하면 빠르고 전력 소모가 적음.  
- 그런데 그냥 8bit로 잘라버리면 값이 망가져서 정확도 ↓.  
- 그래서 대표적인 입력 데이터를 넣어보고, 각 레이어별 값의 범위를 측정 → 8bit 변환 시 값이 최대한 원본과 비슷하게 유지되도록 **스케일(scale)과 오프셋(offset)**을 정함  

📗 Calibration Table (calib.table)

INT8 변환 시 `숫자를 어떻게 줄일지` 기록한 표  

생성 방법  

- 대표 이미지를 모델에 넣어보고, 그 값을 분석해서 저장  
- 이후 추론 시 이 표를 불러와서 동일하게 INT8 변환  

📗 스케일과 오프셋

`물컵에 물이 1리터 들어있는데, 200ml 컵에 나눠 담아야 할 때, scale = 컵 용량 비율, offset = 컵의 시작 위치.`  

- 모델 학습은 보통 **float32(소수점)**로 함 → 값의 범위가 매우 넓고 정밀함  
    - 예: `[-0.00321, 0.25, 3.14159, 255.0]`  
- 하지만 NPU에서 **int8(정수)**로 바꾸면, 가질 수 있는 값은 딱 -128 ~ +127뿐즉,  
- 원래 값들을 정수 범위 안에 "맞춰서" 담아야 함 → 스케일과 오프셋이 필요한 이유  

```shell
int8_value = round( float32_value / scale ) + offset
```  
- scale: float 값과 int 값 사이의 간격(비율)  
    - 한 칸당 얼마? 를 정하는 값  
- offset: 변환할 때, 기준점(0점)을 맞추는 값  
    - 정수 범위의 가운데가 float의 어떤 값에 해당하는지 결정  

```shell
min = 0.0, max = 255.0
scale = (max - min) / (127 - (-128)) ≈ 1.0
offset = -128
```  
- 이렇게 하면 float 0.0 → int8 -128  
- float 255.0 → int8 127    

📗 8 bit integer 형식이 inference 최적화에 적합한 이유

- 메모리 효율성 (메모리 사용량 감소)  
- 연산 속도  
    - 대부분의 하드웨어에서 정수 연산이 부동소수점 연산보다 빠름  
- 에너지 효율성  

📗 NMS (Non-Maximum Suppression, 비최대 억제)

모델이 같은 물체를 여러 번 찾아서 박스를 겹처 찍을 때, 이를 중복제거하는 방법  

- 신뢰도가 가장 높은 박스를 남기고, 겹치는 박스(Overlap, IoU가 일정 이상)은 없앰  
    - conf_thres(신뢰도 임계)로 너무 낮은 박스는 먼저 버리고  
    - 남은 박스들 중 가장 점수 높은 박스를 하나 남긴 뒤, 그와 IoU(Iou_thres 이상으로 많이 겹치는 박스는 제거)  
    - 를 반복하여, 중복 박스 제거 ➡️ 최종 박스만 남기는 단계  

외부 NMS vs 내부 NMS  

- 내부 NMS: 모델 안에서 자동으로 처리.  
    - 모델 안에 NMS 과정이 포함되어, 결과가 바로 `최종 박스`  
    - 장점: 간단, 속도가 조금 빠를 수 있음  
    - 단점: 파라미터(conf, IoU)를 변경하기 어렵거나 엔진마다 구현이 달라 공정 비교가 어려움  
- 외부 NMS: 모델은 후보 박스만 내고, 외부 코드(파이썬/C++)에서 따로 처리.  
- 비교 실험에서는 둘 다 외부 NMS로 맞추면 조건이 동일해져서 공정함.  

📗 mAP (Mean Average Precision)

정확도 측정 방법  

- 모델이 예측한 박스와 정답 박스가 얼마나 잘 맞는지 비교.  
- IoU(겹치는 비율)가 일정 이상이면 “맞았다”고 침.  
- 여러 조건에서 평균을 내서 점수 계산 → 0~100점 사이  

mAP@0.5: IoU 50% 이상이면 정답으로 인정  

mAP@[.50:.95]: IoU 50%, 55%, … 95%까지 모두 평가해 평균  

 
📗 지연시간(Latency) & FPS

Latency: 1장의 이미지를 처리하는 데 걸리는 시간(ms). 작을수록 좋음.  

FPS: 초당 몇 장의 이미지를 처리하는지. 클수록 좋음.  

- FPS = 1000 / Latency(ms) (대략적인 관계)  

📗 그레이스케일 (Grayscale)

컬러 사진의 (RGB) 색 정보를 없애고, 밝기 정보(0~255)만 남긴 흑백 이미지  

- 색깔이 꼭 필요하지 않은 경우, 데이터 양을 줄이고 연산 속도를 높임  
- 예를 들어 번호판 글자를 읽을 때는 색보다 글자의 모양이 더 중요

📗 데이터 증강(Augmentation)

학습 데이터의 다양성을 늘리기 위해 원본 이미지를 변형하는 기법  

- 좌우 뒤집기, 회전, 밝기 변경 등  

같은 데이터를 여러 모습으로 보여줘서 모델이 더 일반적으로 배우게 함: 과적합 방지

📗 과적합 (Overfitting)  

학습 데이터에는 엄청 잘 맞추지만, 새로운 데이터(테스트)에는 성능이 떨어지는 현상  


📗 하이퍼파라미터 (Hyperparameter)

모델 학습 과정에서 사람이 직접 정하는 값  

- 학습률, 배치 크기, 에폭 수 등  

📗 에폭 (Epoch)

전체 데이터셋을 한 번 다 학습시키는 과정을 1 에폭이라고 함  

- 예) 150에폭: 데이터셋을 150번 반복해서 학습  
    - 모델이 충분히 배울 만큼 반복하되, 너무 많으면 과적합 위험이 있음  

📗 손실 함수 (Loss Function)

모델이 예측한 값과 정답의 차이를 숫자로 계산하는 공식  

- 교차 엔트로피 오차함수 (Cross Entropy Loss)  
    - 분류 문제(예: 고양이/개/사람구분)에 주로 사용  
    - 정답에 가까울수록 값이 작아지고, 틀릴수록 값이 커짐  
    - 모델은 이 값을 줄이도록 학습  


📗 후처리(Post-processing)  

- 모델이 출력한 raw tensor를 사람이 이해할 수 있는 detection box로 바꾸는 과정  
    - YOLO 계열 모델의 출력 = (N, anchors, classes+box+score) 이런 큰 배열  
        - Bounding box decode: 모델이 출력한 상대 좌표(anchor 기반)를 실제 이미지 좌표(x, y, w, h)로 변환  
        - Confidence filtering: `conf_thres` (예: 0.25 이상) 보다 낮은 박스는 다 버림  
        - Non-Maximum Suppression (NMS): 같은 물체를 여러 박스로 잡을 때, `iou_thres` 기준으로 겹치는 박스 중 가장 점수 높은 것만 남기고 나머지는 제거  
    - 즉, 모델 출력을 ➡️ 최종 예측 박스로 바꾸는 과정  

📗 평가 단계 (eveluation)  

- `Evaluate annotation type *bbox*`  
    - 모델이 뽑은 박스 ↔ 정답(annotation) 박스 비교 → mAP/AR 계산

📗 E2E (End to End)  

아래 과정을 모두 포함  

- 전처리 (이미지 읽기 ➡️ 리사이즈 ➡️ 정규화)  
- 추론 (모델 실행)  
- 후처리 (NMS, 좌표 변환, 시각화 등)  

평가 단계의 경우, 

- `pycocotools`같은 라이브러리를 이용해 예측 박스 ↔ 정답 annotation 비교 → `mAP/AR` 산출 등을 수행
- 이 과정은 보통 추론이 끝난 후 별도 루프에서 실행  


📗 학습 모델 성능 지표

- Precision (정밀도): 모델이 "맞다고 예측한 것" 중에서 실제로 맞은 비율.  
- Recall (재현율): 실제로 맞는 것 중에서 모델이 맞다고 예측한 비율.  
- mAP@.5: IoU(겹침 비율)가 50% 이상일 때의 평균 정확도.  
- Accuracy (정확도): 전체 예측 중에서 맞은 비율.  

📗 추론 성능 지표  

- 소요시간  
    - Model Load Time (모델 로드 시간)  
        - 모델 파일(ONNX, TensorRT 엔진 등)을 디스크에서 읽어와서 메모리에 올리는 데 걸리는 시간.  
        - 실시간 서비스에서는 모델이 자주 교체되거나 재시작될 수 있기 때문에 로드 시간이 길면 초기 응답이 늦어짐  
        - 배포 환경(서버 시작, 컨테이너 재기동 등)에서 모델 로드 속도는 운영 효율과 직결  
    - FPS (Frames Per Second)  
        - 모델이 1초에 처리할 수 있는 이미지(프레임) 수  
        - FPS가 높을수록 처리 속도가 빠르다는 의미  
        - 실시간 영상 처리(예: CCTV, 자율주행, 실시간 번호판 인식 등)에서는 FPS가 높아야 지연 없이 결과 제공 가능  
        - 예: 30 FPS = 1초에 30장 처리 → 실시간 영상과 동일 속도  
- 사용 메모리 (CPU 사용 시는 RAM, GPU 사용시는 VRAM과 RAM을 합한 값)  
    - 추론 작업을 하는 동안 평균적으로 점유한 메모리(RAM) 용량  
    - 메모리 사용량이 높으면 동시 처리 가능한 작업 수가 줄고, 서버나 임베디드 장치에서 부담이 커짐  
    - 특히 GPU 메모리(VRAM) 사용량이 많으면 한 번에 처리할 수 있는 배치 크기(batch size)가 제한  
- 정확도  
    - 전체 예측 중에서 맞춘 비율  
        - 주로 이미지 분류 모델(예: ResNet)의 성능 평가에 사용  
        - 예: 100장 중 97장 맞춤 → 정확도 97%  
    - 예) mAP@.5 (mean Average Precision at IoU threshold 0.5)  
        - 객체 탐지 모델에서 쓰이는 지표로, 예측한 박스와 실제 박스가 50% 이상 겹쳤을 때의 평균 정확도  
        - 단순히 "맞췄다/틀렸다"가 아니라, 위치까지 정확히 맞췄는지를 평가
        - YOLO 같은 객체 탐지 모델에서 표준처럼 사용  


📗 성능 지표 예

`김정현, 이다은, 최수빈, 전경구. (2024). ONNX 기반 런타임 성능 분석: YOLO와 ResNet. 한국빅데이터학회 학회지, 9(1), 89-100. https://doi.org/10.36498/kbigdt.2024.9.1.89`  

![paper_model_accuracy](./assets/image/paper_model_accuracy.png)  

![paper_inference_time](./assets/image/paper_inference_time.png)  

![paper_inference_memory](./assets/image/paper_inference_memory.png)  

![paper_inference_accuracy](./assets/image/paper_inference_accuracy.png)  

--- 

# 2. 환경 구성

## 2.1 Device Driver, SDK, Utility Tools 설치 

🔗 [GPU (Manual Setup)](../kubernetes/accelator.html#11-gpu-manual-setup)
🔗 [NPU (Manual Setup)](../kubernetes/accelator.html#21-npu-furiosa)

## 2.2 공통

```shell
sudo apt install python3.10-venv -y

sudo apt-get update
sudo apt-get install -y libgl1 libglib2.0-0
```

## 2.3 Kubernetes (TBD)

### (TBD) K8s 클러스터

| 항목 | 내용 |
|------|------|
| 노드 분리 | Furiosa NPU와 NVIDIA A30이 탑재된 노드를 서로 다른 NodeGroup으로 구성 |
| 디바이스 플러그인 | 각각의 장치에 맞는 K8s device plugin 배포:<br>- Furiosa: `npu-device-plugin`<br>- NVIDIA: `nvidia-device-plugin` |
| Namespace/Pod 격리 | 디바이스별 namespace 또는 pod label로 격리 |
| NodeSelector 설정 | 각 실험 Pod에서 NodeSelector로 정확한 노드에 스케줄 |
| 리소스 제한  `resources.limits` 및 `resources.requests` 설정으로 공정성 확보 |

### (TBD) 컨테이너 및 모델 구성
- YOLO 모델은 ONNX 형식으로 변환해 사용하거나, 각 디바이스에 맞는 형식으로 최적화
- Furiosa: furiosa-sdk, furiosa-serving 기반 컨테이너
- NVIDIA: torch, onnxruntime-gpu, tensorrt 기반 컨테이너

### (TBD) 측정 자동화 스크립트 (예)
- Python 측정 스크립트 + time logger
- Prometheus + Grafana (리소스 사용량 수집)
- Custom log collector (latency 및 throughput 기록)

--- 

# 6. 기타

## 6.1 Error (Warboy)

📕 ALL NPU Device is busy

- 비정상 종료를 반복하다 보면 프로세스 정리가 안되는 경우 발생  

```shell
runtime.FuriosaRuntimeError: runtime error: All NPU device is busy: Device warboy(1)*1 found but still in use
```  

```shell
ps -ef | grep warboy
kill -9 <PID들>
```  

- `warboy-vision model-performance` 을 수행한 경우에는 아래와 같이 정리한다  

```shell
pkill -f "warboy-vision model-performance"
```


📕 Out of memory  

- 모델별, 특정 배치사이즈가 넘어가면, 메모리 부족 오류가 발생한다.  

```shell
2025-08-29T07:01:43.030515Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-3939de5e] the model compile is successful (took 1 secs)
[946120.935172963] uNpuDrv (E) [alloc:59] Not enough memory. remained(1410207744), usage(15702421504), alloc_size(1427492864)
[946120.950920924] uNpuDrv (E) [alloc:59] Not enough memory. remained(1410207744), usage(15702421504), alloc_size(1427492864)
[946120.966629024] uNpuDrv (E) [alloc:59] Not enough memory. remained(1410207744), usage(15702421504), alloc_size(1427492864)
[946120.982370205] uNpuDrv (E) [alloc:59] Not enough memory. remained(1410207744), usage(15702421504), alloc_size(1427492864)
[946120.998060557] uNpuDrv (E) [alloc:59] Not enough memory. remained(1410207744), usage(15702421504), alloc_size(1427492864)
2025-08-29T07:01:43.298661Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 16 NPU threads on npu:0:0-1 (DRAM: 21.3 GiB/16.0 GiB, SRAM: 32.0 MiB/128.0 MiB)
thread 'npu:0:0-1-commit-thread' panicked at 'fail to send the event', furiosa-rt-core/src/npu/npu_api.rs:427:5
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
thread 'tokio-runtime-worker' panicked at 'fail to send the event', furiosa-rt-core/src/npu/async_impl/threaded.rs:297:9
```  

📕 mismatching dimension  

- 특정 배치 사이즈(여기에서는 32)로 컴파일된 enf 사용 시, 전처리 코드를 수정하지 않으면 아래와 같은 오류가 발생함  

```shell
(venv) kcloud@k8s-worker1:~/warboy-vision-models/warboy-vision-models$ warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml --batch-size 32

# ...
File "/home/kcloud/warboy-vision-models/venv/lib/python3.10/site-packages/src/test_scenarios/e2e/object_det.py", 
line 190, in task preds = await runner.run([inp]) ValueError: mismatching dimension: expected (32, 3, 640, 640)) got (1, 3, 640, 640)
```

📕 ENF Slice

- ENF의 slice 구성이 맞지 않을 경우  
    - ENF는 특정 하드웨어 slice 수 (예: 128 dpes)로 컴파일 됨
    - 지금 사용 중인 (warboy-b0, 64dpes)와 ENF가 불일치되어 실행 실패  
    - ENF 만들 때 장치 slice 구성을 현재 장치와 같게 설정해 주어야 한다  
    - `--target-npu warboy` 으로 ENF 컴파일해야 한다.
- `slice`  
    - 하드웨어 내부의 연산 자원 분할 단위  
    - 내부에 DPE (Data Processing Element) 연산 코어 집합  
    - 64 dpes → 1 slice 로 구성된 단일 장치  
    - 128 dpes → 2 slice 로 구성된 장치 (병렬 실행 가능)  
     

```shell  
INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:0 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
2025-09-04T08:21:18.559808Z INFO furiosa_rt_core::driver::event_driven::coord: [Sess-ba271c18] the model compile is successful (took 3 secs) 2025-09-04T08:21:18.567307Z INFO furiosa_rt_core::driver::event_driven::coord: compilation failed, unloading npu:0:1 2025-09-04T08:21:18.567344Z ERROR furiosa_rt_core::driver::event_driven::coord: [Runtime-0] EventLoop shutting down due to a FATAL ERROR: "Model and device configuration mismatch (num_slice: 128 != 64)"
```  

## 6.2 이전 코드


📕 이 방식(`_inference_with_metrics()`)은 warboy-vision-models 기존 코드에 있던 `process_pipeline.py` 을 사용하지 않는다.   

- 즉, 미리 구현되어 있는 `image_encoder.py, image_decoder.py, preprocess.py, postprocess.py`를 활용하지 않음  
    - 따라서 성능 측정 시, Warboy 성능이 대폭 하락하여 더 이상 사용하지 않는다.           
- 기존 `accuracy_det()` 추론 방식은  
    - PipeLine 객체 생성  
    - Engine, ImageList, Preprocessor, Postprocessor 등을 등록  
    - .run() 실행 → 내부에서 multiprocessing 기반 병렬 파이프라인 실행  
    - 결과(outputs)를 받아 COCOeval로 평가  
    - 따라서, 멀티 프로세서 구조 → 실제 서비스/스트리밍용에 가까움
- `_inference_with_metrics()` 추론 방식은  
    - Preprocessor, Postprocessor를 직접 객체화  
    - MSCOCODataLoader로 데이터 반복  
    - _inference_with_metrics()에서 **time.perf_counter()**로 pre/infer/post 각각 stopwatch 측정  
    - 결과는 list에 append 후, JSON 형태로 avg/p50/p90/p99 계산  
    - 특징   
        - 단일 루프 기반 (asyncio + runner.run)  
        - 성능 측정 중심 (latency & throughput 계산)  
        - 평가(COCOeval)는 동일하게 수행하지만, 실행 구조는 단순화됨  
-  `async with create_runner(model_path, worker_num=worker_num, ...) as` , `task(runner, data_loader, i, worker_num) for i in range(worker_num)`  
    - asyncio 코루틴 단위로 분할 실행, runner는 단일 프로세스 내에서 concurrency를 관리함 = 이벤트 루프 방식
    - 즉, Pipeline 처럼 프로세스 분리(Multiprocessing)이 아니라 같은 런타임 세션에서 비동기 태스크로 여러 worker를 훙내 내는 방식  
        - 따라서 Pipeline 보다 실측 성능이 낮게 나올 수 있다.   

```python
##-- ... 
async def _inference_with_metrics(model, data_loader, preprocessor, postprocessor,
                                  batch_size=1, worker_num=16, output_dir="outputs"):
    """
    수집 지표
    - e2e_wall   : (대기 포함) per-image 경과시간 ms
    - e2e_active : (대기 제외) per-image (pre + batch_infer/N + post) ms
    - inf        : per-image 순수 NPU(추론) ms
    - pre/post   : per-image 전/후처리 ms
    - batch_exec : 각 배치 run의 실행 로그 [{"n": 배치크기, "infer_ms": 배치 전체 NPU시간}, ...]
                   * 잔여 패딩 배치도 실행된 크기(=batch_size)로 기록 (HW 관점 처리량 반영)
    """
    from furiosa.runtime import create_runner
    import numpy as np
    from pathlib import Path
    import cv2, time

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    saved_count = 0

    async def task(runner, data_loader, worker_id, worker_num):
        nonlocal saved_count
        e2e_wall_ms, e2e_active_ms = [], []
        inf_ms, pre_ms, post_ms, results = [], [], [], []
        batch_exec_log = []  ##-- 배치 실행 로그
        batch_buf = []  ##-- (inp3d, ctx, img0shape, ann, img, t0, t1, pre_ms_i)

        def visualize_and_collect(outputs, img, annotation):
            nonlocal saved_count, results
            bboxes = xyxy2xywh(outputs[:, :4]); bboxes[:, :2] -= bboxes[:, 2:] / 2
            for output, bbox in zip(outputs, bboxes):
                results.append({
                    "image_id": annotation["id"],
                    "category_id": YOLO_CATEGORY_TO_COCO_CATEGORY[int(output[5])],
                    "bbox": [round(x, 3) for x in bbox],
                    "score": round(float(output[4]), 5),
                })
            if saved_count < 10:
                for det in outputs:
                    x1, y1, x2, y2, conf, cls = det[:6]
                    cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), (0,255,0), 2)
                    cv2.putText(img, f"{int(cls)} {conf:.2f}",
                                (int(x1), max(int(y1)-5, 0)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 1)
                out_path = Path(output_dir) / f"{saved_count+1}.jpg"
                cv2.imwrite(str(out_path), img); saved_count += 1

        for idx, (img_path, annotation) in enumerate(data_loader):
            if idx % worker_num != worker_id:
                continue

            img = cv2.imread(str(img_path))
            img0shape = img.shape[:2]

            # 전처리
            t0 = time.perf_counter()
            inp, ctx = preprocessor(img)  # (C,H,W) 또는 (1,C,H,W)
            t1 = time.perf_counter()
            pre_ms_i = (t1 - t0) * 1000.0

            if batch_size == 1:
                # 단일 배치: e2e_wall == e2e_active
                inp_4d = inp[np.newaxis, ...] if inp.ndim == 3 else inp
                t2 = time.perf_counter()
                preds = await runner.run([inp_4d])
                t3 = time.perf_counter()
                batch_infer_ms = (t3 - t2) * 1000.0
                # 배치 실행 로그 (N=1)
                batch_exec_log.append({"n": 1, "infer_ms": batch_infer_ms})

                t4 = time.perf_counter()
                outputs = postprocessor(preds, ctx, img0shape)[0]
                t5 = time.perf_counter()

                post_i = (t5 - t4) * 1000.0
                infer_i = batch_infer_ms  # N=1
                e2e_wall_i = (t5 - t0) * 1000.0
                e2e_active_i = pre_ms_i + infer_i + post_i

                pre_ms.append(pre_ms_i); inf_ms.append(infer_i); post_ms.append(post_i)
                e2e_wall_ms.append(e2e_wall_i); e2e_active_ms.append(e2e_active_i)
                visualize_and_collect(outputs, img, annotation)

            else:
                # 다중 배치: 3D로 통일 → 스택
                if inp.ndim == 4:
                    if inp.shape[0] != 1:
                        raise ValueError(f"For bs>1, expected leading batch 1. got {inp.shape}")
                    inp3d = inp[0]
                elif inp.ndim == 3:
                    inp3d = inp
                else:
                    raise ValueError(f"Unexpected input ndim for bs>1: {inp.ndim}")

                batch_buf.append((inp3d, ctx, img0shape, annotation, img, t0, t1, pre_ms_i))

                # 배치가 찼을 때 실행
                if len(batch_buf) == batch_size:
                    batched_input = np.stack([b[0] for b in batch_buf], axis=0)  # (N,C,H,W)
                    t2 = time.perf_counter()
                    preds = await runner.run([batched_input])  # heads: (N,*,H,W)...
                    t3 = time.perf_counter()
                    batch_infer_ms = (t3 - t2) * 1000.0
                    N = len(batch_buf)
                    batch_exec_log.append({"n": N, "infer_ms": batch_infer_ms})

                    heads = list(preds) if isinstance(preds, (tuple, list)) else [preds]
                    for i in range(N):
                        inp_i, ctx_i, img0shape_i, ann_i, img_i, t0_i, t1_i, pre_i = batch_buf[i]
                        # per-image heads → 4D 보장
                        per_img_heads = []
                        for h in heads:
                            if h.ndim == 4:   per_img_heads.append(h[i][np.newaxis, ...])
                            elif h.ndim == 3: per_img_heads.append(h[np.newaxis, ...])
                            else: raise ValueError(f"Unexpected head ndim (batch): {h.ndim}")

                        t4 = time.perf_counter()
                        outputs = postprocessor(per_img_heads, ctx_i, img0shape_i)[0]
                        t5 = time.perf_counter()

                        post_i = (t5 - t4) * 1000.0
                        infer_i = batch_infer_ms / N
                        e2e_active_i = pre_i + infer_i + post_i
                        e2e_wall_i   = (t5 - t0_i) * 1000.0  # 대기 포함

                        pre_ms.append(pre_i); inf_ms.append(infer_i); post_ms.append(post_i)
                        e2e_active_ms.append(e2e_active_i); e2e_wall_ms.append(e2e_wall_i)
                        visualize_and_collect(outputs, img_i, ann_i)

                    batch_buf = []

        # 잔여 묶음(패딩 실행)
        if batch_size > 1 and len(batch_buf) > 0:
            actual = len(batch_buf)
            pad_needed = batch_size - actual
            batch_padded = batch_buf + [batch_buf[-1]] * pad_needed
            batched_input = np.stack([b[0] for b in batch_padded], axis=0)
            t2 = time.perf_counter()
            preds = await runner.run([batched_input])
            t3 = time.perf_counter()
            batch_infer_ms = (t3 - t2) * 1000.0
            # 실행은 batch_size로 이루어졌으므로 HW 관점 처리량에선 N=batch_size로 기록
            batch_exec_log.append({"n": batch_size, "infer_ms": batch_infer_ms})

            heads = list(preds) if isinstance(preds, (tuple, list)) else [preds]
            for i in range(actual):
                inp_i, ctx_i, img0shape_i, ann_i, img_i, t0_i, t1_i, pre_i = batch_buf[i]
                per_img_heads = []
                for h in heads:
                    if h.ndim == 4:   per_img_heads.append(h[i][np.newaxis, ...])
                    elif h.ndim == 3: per_img_heads.append(h[np.newaxis, ...])
                    else: raise ValueError(f"Unexpected head ndim (remainder): {h.ndim}")

                t4 = time.perf_counter()
                outputs = postprocessor(per_img_heads, ctx_i, img0shape_i)[0]
                t5 = time.perf_counter()

                post_i = (t5 - t4) * 1000.0
                infer_i = batch_infer_ms / batch_size  # 패딩 포함 분배
                e2e_active_i = pre_i + infer_i + post_i
                e2e_wall_i   = (t5 - t0_i) * 1000.0

                pre_ms.append(pre_i); inf_ms.append(infer_i); post_ms.append(post_i)
                e2e_active_ms.append(e2e_active_i); e2e_wall_ms.append(e2e_wall_i)
                visualize_and_collect(outputs, img_i, ann_i)

        return e2e_wall_ms, e2e_active_ms, inf_ms, pre_ms, post_ms, batch_exec_log, results

    async with create_runner(model, worker_num=worker_num,
                             compiler_config={"use_program_loading": True}) as runner:
        parts = await asyncio.gather(*[
            task(runner, data_loader, i, worker_num) for i in range(worker_num)
        ])

    e2e_wall_all, e2e_active_all, inf_all, pre_all, post_all, batch_exec_all, results_all = [], [], [], [], [], [], []
    for e2e_wall_ms, e2e_active_ms, inf_ms, pre_ms, post_ms, batch_exec_log, results in parts:
        e2e_wall_all.extend(e2e_wall_ms)
        e2e_active_all.extend(e2e_active_ms)
        inf_all.extend(inf_ms); pre_all.extend(pre_ms); post_all.extend(post_ms)
        batch_exec_all.extend(batch_exec_log)
        results_all.extend(results)

    return {
        "e2e_wall": e2e_wall_all,       # 대기 포함 per-image(ms)
        "e2e_active": e2e_active_all,   # 대기 제외 per-image(ms)
        "inf": inf_all, "pre": pre_all, "post": post_all,
        "batch_exec": batch_exec_all    # [{"n": N, "infer_ms": batch_ms}, ...]
    }, results_all
```  

- test_warboy_yolo_performance_det()  
    - config는 기 생성된 enf가 있을 경우, 이를 활용하여 onnx → 양자화 → 컴파일 과정을 Skip 하도록 함    
        - `if use_enf:` 부분 추가  
    - 데이터 로딩  
        - `MSCOCODataLodaer`로 이미지 및 annotation 불러옴
    - 전처리  
        - `YoloPreProcessor`로 이미지 resize, normalize (warboy/yolo/preprocess.py)
    - 후처리  
        - `ObjectDetPostprocess`로 raw tensor → bounding box decode + NMS (warboy/yolo/postprocess.py)  
    
- `_inference_with_metrics()`가 실행되는 시간을 e2e 전체 시간으로 측정(`wall_elapsed` = `Inference Done in .. sec`)  
    - 이 때, `worker_num` 값으로 병렬 추론 진행 


```python
def test_warboy_yolo_performance_det(config_file: str, image_dir: str, annotation_file: str,
                                     use_enf=True, batch_size: int=1):
    """COCO mAP + latency/throughput JSON + 10장 이미지 출력 (per-image 기준으로 일관 출력)"""

    param = get_model_params_from_cfg(config_file)
    model_name = param["model_name"]; input_shape = param["input_shape"]; anchors = param["anchors"]

    # YAML 기반 conf/iou
    engin_configs = set_test_engin_configs(param, 1)
    conf_thres = engin_configs[0]["conf_thres"]; iou_thres = engin_configs[0]["iou_thres"]

    # 모델 경로
    if use_enf:
        enf_file = f"{model_name}_{batch_size}b.enf" if batch_size > 1 else f"{model_name}.enf"
        enf_path = ENF_DIR / param["task"] / enf_file
        if enf_path.is_file(): model_path = str(enf_path)
        else: raise FileNotFoundError(f"ENF file not found: {enf_path}")
    else:
        model_path = param.get("onnx_i8_path") or os.path.join(QUANTIZED_ONNX_DIR, param["task"], param["onnx_i8_path"])

    # 전/후처리
    preprocessor = YoloPreProcessor(new_shape=input_shape[2:])
    postprocessor = ObjDetPostprocess(
        model_name, {"conf_thres": conf_thres, "iou_thres": iou_thres, "anchors": anchors},
        None, False
    ).postprocess_func

    # COCO
    data_loader = MSCOCODataLoader(Path(image_dir), Path(annotation_file), preprocessor, input_shape)

    # 추론
    wall_start = time.time()
    metrics, results = asyncio.run(
        _inference_with_metrics(model_path, data_loader, preprocessor, postprocessor, batch_size=batch_size)
    )
    wall_elapsed = time.time() - wall_start
    print(f"Inference Done in {wall_elapsed:.2f} sec")

    # 요약 함수 (avg/p50/p90/p99 모두 반환)
    def summarize(xs: List[float]):
        avg, p50, p90, p99 = quantiles(xs)
        return {"avg": avg, "p50": p50, "p90": p90, "p99": p99}

    # 요약 지표
    e2e_active = summarize(metrics["e2e_active"])   # 대기 제외 per-image
    e2e_wall   = summarize(metrics["e2e_wall"])     # 대기 포함 per-image
    inf        = summarize(metrics["inf"])
    pre        = summarize(metrics["pre"])
    post       = summarize(metrics["post"])

    # 대기시간(= e2e_wall - e2e_active)
    wait_ms_list = [w - a for w, a in zip(metrics["e2e_wall"], metrics["e2e_active"])]
    wait = summarize(wait_ms_list)
    wait_ratio = (wait["avg"] / e2e_wall["avg"]) if (wait["avg"] and e2e_wall["avg"]) else None

    # 처리량(1장 기준만 기본 표기)
    ips_e2e_active     = (1000.0 / e2e_active["avg"]) if e2e_active["avg"] else None
    ips_inf            = (1000.0 / inf["avg"])        if inf["avg"]        else None
    ips_e2e_wall_imgps = (1000.0 / e2e_wall["avg"])   if e2e_wall["avg"]   else None

    # (옵션) 데이터셋 전체 처리량 & NPU 배치 처리량
    dataset_throughput_wall = (len(metrics["e2e_active"]) / wall_elapsed) if wall_elapsed > 0 else None
    total_imgs_in_batches   = sum(b["n"] for b in metrics["batch_exec"])
    total_infer_ms_batches  = sum(b["infer_ms"] for b in metrics["batch_exec"])
    hardware_batch_throughput = (
        (1000.0 * total_imgs_in_batches) / total_infer_ms_batches
        if total_infer_ms_batches > 0 else None
    )

    summary = {
        "model": model_path,
        "cfg": config_file,
        "images": len(metrics["e2e_active"]),
        "throughput_img_per_s": {  # 항상 '1장 기준'만 표기
            "e2e_active": ips_e2e_active,         # 권장 비교 지표
            "infer_only": ips_inf,                # 순수 NPU per-image
            "e2e_wall_per_image": ips_e2e_wall_imgps  # 대기 포함 per-image
        },
        "latency_ms": {
            "pre": pre, "infer": inf, "post": post,
            "e2e_active": e2e_active, "e2e_wall": e2e_wall,
            "wait": wait, "wait_ratio": wait_ratio
        },
        "dataset": {  # 해석용 보조 지표 (필요 시 참조)
            "throughput_wall_img_per_s": dataset_throughput_wall,
            "hardware_batch_throughput_img_per_s": hardware_batch_throughput
        }
    }

    print(json.dumps(summary, indent=2))
    Path("outputs").mkdir(exist_ok=True)
    with open("outputs/results.json", "w") as f:
        json.dump(summary, f, indent=2)

    # COCO mAP
    coco_result = data_loader.coco.loadRes(results)
    coco_eval = COCOeval(data_loader.coco, coco_result, "bbox")
    coco_eval.evaluate(); coco_eval.accumulate(); coco_eval.summarize()

    mAP = coco_eval.stats[0]
    target = TARGET_ACCURACY.get(model_name, 0.3) * 0.9
    if mAP >= target:
        print(f"{model_name} Accuracy check success! -> mAP: {mAP} [Target: {target}]")
    else:
        print(f"{model_name} Accuracy check failed! -> mAP: {mAP} [Target: {target}]")
##-- ... 
```  

### 평가 및 결과

```shell
##-- 실행 결과 >
(venv) kcloud@k8s-worker2:~/warboy-vision-models/warboy-vision-models$ warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml
0.001 0.7 [None] False
loading annotations into memory...
Done (t=0.45s)
creating index...
index created!
2025-08-19T10:38:49.584625Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
2025-08-19T10:38:49.591836Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2025-08-19T10:38:49.591865Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2025-08-19T10:38:49.591877Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
2025-08-19T10:38:49.618926Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:0-1 (warboy-b0-2pe, 128dpes, firmware: 1.7.7, 386a8ab)
2025-08-19T10:38:49.619134Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2025-08-19T10:38:49.622326Z  INFO furiosa::runtime: Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20250819103849-cq9y9y.log
2025-08-19T10:38:49.637183Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-32b2c6c7 using npu:0:0-1
2025-08-19T10:38:49.659047Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-32b2c6c7] compiling the model (target: warboy-b0-2pe, 128dpes, file: yolov9t.enf, size: 13.6 MiB)
2025-08-19T10:38:50.148319Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-32b2c6c7] the model compile is successful (took 0 secs)
2025-08-19T10:38:50.214578Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 16 NPU threads on npu:0:0-1 (DRAM: 42.7 MiB/16.0 GiB, SRAM: 11.4 MiB/128.0 MiB)
2025-08-19T10:39:58.226942Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-32b2c6c7] terminated
2025-08-19T10:39:58.429235Z  INFO furiosa_rt_core::npu::raw: NPU (npu:0:0-1) has been closed
2025-08-19T10:39:58.433986Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] stopped
Inference Done in 68.93 sec
{
  "model": "../models/enf/object_detection/yolov9t.enf",
  "cfg": "tutorials/cfg/yolov9t.yaml",
  "images": 5000,
  "throughput_img_per_s": {
    "e2e": 4.789169679119893,
    "infer_only": 4.912782705593637
  },
  "latency_ms": {
    "pre": {
      "avg": 0.7833296074328245,
      "p50": 0.7361555035458878,
      "p90": 1.168547009001486,
      "p99": 1.3575250050053
    },
    "infer": {
      "avg": 203.55062699219562,
      "p50": 195.31430400093086,
      "p90": 224.6619659999851,
      "p99": 467.8322520048823
    },
    "post": {
      "avg": 4.469821264912025,
      "p50": 4.218457994284108,
      "p90": 5.363285992643796,
      "p99": 7.884419013862498
    },
    "e2e": {
      "avg": 208.8044623601163,
      "p50": 200.50756000273395,
      "p90": 229.99187199457083,
      "p99": 473.375675996067
    }
  }
}
Loading and preparing results...
DONE (t=3.47s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=47.38s).
Accumulating evaluation results...
DONE (t=8.22s).
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
---   


---   
