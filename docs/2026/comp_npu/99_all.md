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

# 3. Object Detection

🔗 수정한 소스코드 파일  

- [2509_warboy-vision-models.tar.gz](assets/files/2509_warboy-vision-models.tar.gz)  
- [2509_nvidia_yolo.tar.gz](assets/files/2509_nvidia-yolo.tar.gz)  
- [2509_result_img_yolov9t.zip](assets/files/2509_result_img_yolov9t.zip)  

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

LOG_DIR = REPO_ROOT / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

FULL_LOG_FILE = LOG_DIR / f"nvidia_full_{START_TS}.log"
RESULT_LOG_FILE = LOG_DIR / f"nvidia_result_{START_TS}.log"

# 원하는 배치 조합으로 수정 가능
BATCH_SIZES = [1, 4, 8, 16, 32]
#BATCH_SIZES = [1]

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
# Metric Definitions
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
        name=f"{Path(opt.weights).stem}_{opt.batch}",
        half=opt.half,
        save_samples=getattr(opt, "save_samples", 0),
        sample_start=(getattr(opt, "sample_start", None)
                      if getattr(opt, "save_samples", 0) > 0 else None),
    )

    mAP = results[3]
    model_name = Path(opt.weights).stem.replace("-converted", "").replace("-", "")
    target = TARGET_ACCURACY.get(model_name, 0.3) * 0.9
    acc_check = "success" if mAP >= target else "fail"

    e2e_q = quantiles(e2e_ms_list)
    #wall_elapsed = time.time() - start
    #num_images = len(lat_dict["lat_pre"])
    #e2e_wall_imgps = num_images / wall_elapsed if wall_elapsed > 0 else None

    pre_q = quantiles(lat_dict["lat_pre"])
    inf_q = quantiles(lat_dict["lat_infer"])
    post_q = quantiles(lat_dict["lat_post"])

    acc_check = "success" if mAP >= target else "fail"

    summary = {
        "model": model_name,
        "images": len(lat_dict["lat_pre"]),
        "throughput_img_per_s": {
            #"e2e_wall_per_image": e2e_wall_imgps,
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
        #f"e2e_wall_imgps={summary['throughput_img_per_s']['e2e_wall_per_image']} "        
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
        #"| batch_size | e2e_wall_per_image (img/s) | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |",
        "| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |",
        "|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|",
    ]
    for bs in sorted(by_bs.keys()):
        r = by_bs[bs]
        thr = r["throughput_img_per_s"]
        lat = r["latency_ms"]
        acc = r["metrics"]
        table.append(
            #f"| {bs} | {fmt(thr.get('e2e_wall_per_image'))} | "
            f"| {bs} | "
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
        #"| batch_size | e2e_wall_per_image (img/s) | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |",
        "| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |",
        "|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|",
    ]
    for model, bs_dict in all_results.items():
        if batch not in bs_dict:
            continue
        r = bs_dict[batch]
        thr = r["throughput_img_per_s"]
        lat = r["latency_ms"]
        acc = r["metrics"]
        table.append(
            #f"| {model} | {fmt(thr.get('e2e_wall_per_image'))} | "
            f"| {model} | "
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
    #if metric == "e2e_wall_per_image":
    #    return thr.get("e2e_wall_per_image") or comp.get("e2e_wall_per_image")
    #elif metric == "e2e_active":
    if metric == "e2e_active":
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
        "--save-samples",
        type=int,
        default=0,
        help="Save N sample prediction images with boxes+labels to outputs/ (0=disable)",
    )
    parser.add_argument(
        "--sample-start",
        type=int,
        default=None,
        help="Starting index (1-based) of dataset images to save with --save-samples. "
             "Ignored if --save-samples=0",
    )
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
    precision_str = "f16" if opt.half else "f32"
    log_line("=" * 80)
    log_line(f"===== Simple Run started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} =====")
    log_line(f"Full log file: {FULL_LOG_FILE}")
    log_line(f"Result log file: {RESULT_LOG_FILE}")
    log_line("=" * 80)

    num_gpus = torch.cuda.device_count()
    weights = list(WEIGHT_DIR.glob("*.pt"))
    all_results: Dict[str, Dict[int, dict]] = {}

    for dev_id in range(num_gpus):
    #for dev_id in [1]:
        name = torch.cuda.get_device_name(dev_id)
        log_line("=" * 80)
        log_line(f"[device {dev_id} : {name}] [{precision_str}]", both=True)
        log_line("=" * 80)
        try:
            with RESULT_LOG_FILE.open("a", encoding="utf-8") as rf:
                rf.write("=" * 80 + "\n")
                rf.write(f"[device {dev_id} : {name}] [{precision_str}] \n")
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
                o.save_samples = opt.save_samples
                o.sample_start = opt.sample_start if opt.save_samples > 0 else None

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
(venv) kcloud@k8s-worker1:~/nvidia-yolo/yolov9$ python nvidia_e2e_val.py --simple
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

`[device 0 : NVIDIA A30] [f32]` 📗

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

# 4. Container 

## 4.1 Docker 

### Warboy

```shell
sudo docker run -it --rm \
  --privileged \
  -v /dev:/dev \
  -v /home/kcloud/datasets:/workspace/datasets \
  -v /home/kcloud/models:/workspace/models \
  -v /home/kcloud/warboy-vision-models:/workspace/warboy-vision-models \
  -v /lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu \
  -v /usr/bin/furiosa-compiler:/usr/bin/furiosa-compiler \
  -v /usr/bin/furiosa-compiler-bridge:/usr/bin/furiosa-compiler-bridge \
  -v /usr/bin/furiosa-compile:/usr/bin/furiosa-compile \
  -v /usr/bin/furiosactl:/usr/bin/furiosactl \
  -e LD_LIBRARY_PATH=/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH \
  warboy-vision:latest

##-- container 내부로 진입하여 실행
cd /workspace/warboy-vision-models
pip install -e .

#warboy-vision model-performance --config_file tutorials/cfg/yolov9t.yaml  
python run_performance_suite.py  
```


```shell
##-- 실행 예 >
(venv) kcloud@k8s-worker2:~/warboy-vision-models$ sudo docker run -it --rm \
  --privileged \
  -v /dev:/dev \
  -v /home/kcloud/datasets:/workspace/datasets \
  -v /home/kcloud/models:/workspace/models \
  -v /home/kcloud/warboy-vision-models:/workspace/warboy-vision-models \
  -v /lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu \
  -v /usr/bin/furiosa-compiler:/usr/bin/furiosa-compiler \
  -v /usr/bin/furiosa-compiler-bridge:/usr/bin/furiosa-compiler-bridge \
  -v /usr/bin/furiosa-compile:/usr/bin/furiosa-compile \
  -v /usr/bin/furiosactl:/usr/bin/furiosactl \
  -e LD_LIBRARY_PATH=/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH \
  warboy-vision:latest

root@309f4a84d248:/workspace# cd warboy-vision-models/warboy-vision-models/

root@309f4a84d248:/workspace/warboy-vision-models/warboy-vision-models# pip install -e .
Obtaining file:///workspace/warboy-vision-models/warboy-vision-models
  Installing build dependencies ... done
  Checking if build backend supports build_editable ... done
  Getting requirements to build editable ... done
  Installing backend dependencies ... done
  Preparing editable metadata (pyproject.toml) ... done
Requirement already satisfied: click in /opt/venv/lib/python3.10/site-packages (from warboy-vision-models==0.1.0) (8.2.1)
Building wheels for collected packages: warboy-vision-models
  Building editable for warboy-vision-models (pyproject.toml) ... done
  Created wheel for warboy-vision-models: filename=warboy_vision_models-0.1.0-py3-none-any.whl size=113133 sha256=b75bdbd905a6ac49511ad49f6d5f388bbb3e3c568f68b3708e982a82a23eb71a
  Stored in directory: /tmp/pip-ephem-wheel-cache-pyosq1r2/wheels/89/8c/1d/117ad4e6bb4794f5465c89906633cb1c96778a7ebf9d482700
Successfully built warboy-vision-models
Installing collected packages: warboy-vision-models
Successfully installed warboy-vision-models-0.1.0

root@309f4a84d248:/workspace/warboy-vision-models/warboy-vision-models# python run_performance_suite.py
[2025-09-12 06:20:52] ================================================================================
[2025-09-12 06:20:52] ===== Run started at 2025-09-12 06:20:52 =====
[2025-09-12 06:20:52] Full log file: /workspace/warboy-vision-models/warboy-vision-models/performance_full_20250912_062052.log
[2025-09-12 06:20:52] Result log file: /workspace/warboy-vision-models/warboy-vision-models/performance_result_20250912_062052.log
[2025-09-12 06:20:52] ================================================================================
[2025-09-12 06:20:52] [CLEANUP] Killed leftover 'warboy-vision model-performance' processes
[2025-09-12 06:20:57] Models to process: ['yolov8l', 'yolov8n', 'yolov9c', 'yolov9t']
[2025-09-12 06:20:57] ================================================================================
[2025-09-12 06:20:57] PROCESS MODEL: yolov8l
[2025-09-12 06:20:57] Available batches: [1]
[2025-09-12 06:20:57] RUN: warboy-vision model-performance --config_file /workspace/warboy-vision-models/warboy-vision-models/tutorials/cfg/yolov8l.yaml --batch-size 1
loading annotations into memory...
Done (t=0.42s)
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
2025-09-12T06:21:01.402563Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
2025-09-12T06:21:01.409840Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2025-09-12T06:21:01.409873Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2025-09-12T06:21:01.410971Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
2025-09-12T06:21:01.435413Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:0 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
2025-09-12T06:21:01.435574Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2025-09-12T06:21:01.440497Z  INFO furiosa::runtime: Saving the compilation log into /root/.local/state/furiosa/logs/compiler-20250912062101-fqylyx.log
2025-09-12T06:21:01.496297Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-ae144c9c using npu:0:0
2025-09-12T06:21:01.525537Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-ae144c9c] compiling the model (target: warboy-b0, 64dpes, file: yolov8l.enf, size: 70.6 MiB)
:-) Finished in 0.000003766s
2025-09-12T06:21:04.796743Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-ae144c9c] the model compile is successful (took 3 secs)
2025-09-12T06:21:05.182682Z 
```  

#### Warboy(Container-Docker) 결과  

[model : yolov8l] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 22.742 | 29.434 | 1.590 | 33.974 | 8.409 | 0.495 | 0.476 | success | 201.550 |


[transposed summary: model=yolov8l, conf (0.025), iou (0.700)]

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 22.742 |
| infer_only (img/s) | 29.434 |
| lat_pre (ms) | 1.590 |
| lat_infer (ms) | 33.974 |
| lat_post (ms) | 8.409 |
| mAP | 0.495 |
| Target | 0.476 |
| Status | success |
| sec (s) | 201.550 |


[model : yolov8n] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 58.793 | 91.406 | 1.329 | 10.940 | 4.740 | 0.345 | 0.336 | success | 82.110 |
| 4 | 67.207 | 108.125 | 1.139 | 9.249 | 4.492 | 0.345 | 0.336 | success | 68.970 |
| 8 | 56.902 | 82.518 | 1.109 | 12.119 | 4.346 | 0.345 | 0.336 | success | 84.050 |
| 16 | 62.647 | 95.791 | 1.093 | 10.439 | 4.430 | 0.345 | 0.336 | success | 72.080 |


[transposed summary: model=yolov8n, conf (0.025), iou (0.700)]

| batch_size | 1 | 4 | 8 | 16 |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 58.793 | 67.207 | 56.902 | 62.647 |
| infer_only (img/s) | 91.406 | 108.125 | 82.518 | 95.791 |
| lat_pre (ms) | 1.329 | 1.139 | 1.109 | 1.093 |
| lat_infer (ms) | 10.940 | 9.249 | 12.119 | 10.439 |
| lat_post (ms) | 4.740 | 4.492 | 4.346 | 4.430 |
| mAP | 0.345 | 0.345 | 0.345 | 0.345 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success |
| sec (s) | 82.110 | 68.970 | 84.050 | 72.080 |


[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 28.165 | 39.122 | 1.689 | 25.561 | 8.255 | 0.497 | 0.477 | success | 157.310 |


[transposed summary: model=yolov9c, conf (0.025), iou (0.700)]

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 28.165 |
| infer_only (img/s) | 39.122 |
| lat_pre (ms) | 1.689 |
| lat_infer (ms) | 25.561 |
| lat_post (ms) | 8.255 |
| mAP | 0.497 |
| Target | 0.477 |
| Status | success |
| sec (s) | 157.310 |


[model : yolov9t] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 55.915 | 85.805 | 1.366 | 11.654 | 4.864 | 0.349 | 0.345 | success | 85.200 |
| 4 | 66.682 | 106.741 | 1.150 | 9.369 | 4.478 | 0.349 | 0.345 | success | 69.030 |
| 8 | 57.133 | 84.800 | 1.085 | 11.792 | 4.625 | 0.349 | 0.345 | success | 80.250 |


[transposed summary: model=yolov9t, conf (0.025), iou (0.700)]

| batch_size | 1 | 4 | 8 |
| --- | --- | --- | --- |
| e2e_active (img/s) | 55.915 | 66.682 | 57.133 |
| infer_only (img/s) | 85.805 | 106.741 | 84.800 |
| lat_pre (ms) | 1.366 | 1.150 | 1.085 |
| lat_infer (ms) | 11.654 | 9.369 | 11.792 |
| lat_post (ms) | 4.864 | 4.478 | 4.625 |
| mAP | 0.349 | 0.349 | 0.349 |
| Target | 0.345 | 0.345 | 0.345 |
| Status | success | success | success |
| sec (s) | 85.200 | 69.030 | 80.250 |


[batch_size : 1] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8l | 22.742 | 29.434 | 1.590 | 33.974 | 8.409 | 0.495 | 0.476 | success | 201.550 |
| yolov8n | 58.793 | 91.406 | 1.329 | 10.940 | 4.740 | 0.345 | 0.336 | success | 82.110 |
| yolov9c | 28.165 | 39.122 | 1.689 | 25.561 | 8.255 | 0.497 | 0.477 | success | 157.310 |
| yolov9t | 55.915 | 85.805 | 1.366 | 11.654 | 4.864 | 0.349 | 0.345 | success | 85.200 |


[transposed summary: batch_size=1, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 22.742 | 58.793 | 28.165 | 55.915 |
| infer_only (img/s) | 29.434 | 91.406 | 39.122 | 85.805 |
| lat_pre (ms) | 1.590 | 1.329 | 1.689 | 1.366 |
| lat_infer (ms) | 33.974 | 10.940 | 25.561 | 11.654 |
| lat_post (ms) | 8.409 | 4.740 | 8.255 | 4.864 |
| mAP | 0.495 | 0.345 | 0.497 | 0.349 |
| Target | 0.476 | 0.336 | 0.477 | 0.345 |
| Status | success | success | success | success |
| sec (s) | 201.550 | 82.110 | 157.310 | 85.200 |


[batch_size : 4] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8n | 67.207 | 108.125 | 1.139 | 9.249 | 4.492 | 0.345 | 0.336 | success | 68.970 |
| yolov9t | 66.682 | 106.741 | 1.150 | 9.369 | 4.478 | 0.349 | 0.345 | success | 69.030 |


[transposed summary: batch_size=4, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 67.207 | NA | 66.682 |
| infer_only (img/s) | NA | 108.125 | NA | 106.741 |
| lat_pre (ms) | NA | 1.139 | NA | 1.150 |
| lat_infer (ms) | NA | 9.249 | NA | 9.369 |
| lat_post (ms) | NA | 4.492 | NA | 4.478 |
| mAP | NA | 0.345 | NA | 0.349 |
| Target | NA | 0.336 | NA | 0.345 |
| Status | NA | success | NA | success |
| sec (s) | NA | 68.970 | NA | 69.030 |


[batch_size : 8] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8n | 56.902 | 82.518 | 1.109 | 12.119 | 4.346 | 0.345 | 0.336 | success | 84.050 |
| yolov9t | 57.133 | 84.800 | 1.085 | 11.792 | 4.625 | 0.349 | 0.345 | success | 80.250 |


[transposed summary: batch_size=8, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 56.902 | NA | 57.133 |
| infer_only (img/s) | NA | 82.518 | NA | 84.800 |
| lat_pre (ms) | NA | 1.109 | NA | 1.085 |
| lat_infer (ms) | NA | 12.119 | NA | 11.792 |
| lat_post (ms) | NA | 4.346 | NA | 4.625 |
| mAP | NA | 0.345 | NA | 0.349 |
| Target | NA | 0.336 | NA | 0.345 |
| Status | NA | success | NA | success |
| sec (s) | NA | 84.050 | NA | 80.250 |


[batch_size : 16] : conf (0.025), iou (0.700)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov8n | 62.647 | 95.791 | 1.093 | 10.439 | 4.430 | 0.345 | 0.336 | success | 72.080 |


[transposed summary: batch_size=16, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 62.647 | NA | NA |
| infer_only (img/s) | NA | 95.791 | NA | NA |
| lat_pre (ms) | NA | 1.093 | NA | NA |
| lat_infer (ms) | NA | 10.439 | NA | NA |
| lat_post (ms) | NA | 4.430 | NA | NA |
| mAP | NA | 0.345 | NA | NA |
| Target | NA | 0.336 | NA | NA |
| Status | NA | success | NA | NA |
| sec (s) | NA | 72.080 | NA | NA |

### NVIDIA (A2, A30)

```shell
kcloud@k8s-worker1:~$ nvidia-smi
Tue Sep  2 07:38:51 2025
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 575.64.03              Driver Version: 575.64.03      CUDA Version: 12.9     |
|-----------------------------------------+------------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |
| Fan  Temp   Perf          Pwr:Usage/Cap |           Memory-Usage | GPU-Util  Compute M. |
|                                         |                        |               MIG M. |
|=========================================+========================+======================|
|   0  NVIDIA A30                     Off |   00000000:18:00.0 Off |                    0 |
| N/A   40C    P0             29W /  165W |       0MiB /  24576MiB |      0%      Default |
|                                         |                        |             Disabled |
+-----------------------------------------+------------------------+----------------------+
|   1  NVIDIA A2                      Off |   00000000:86:00.0 Off |                    0 |
|  0%   36C    P8              8W /   60W |       0MiB /  15356MiB |      0%      Default |
|                                         |                        |                  N/A |
+-----------------------------------------+------------------------+----------------------+

+-----------------------------------------------------------------------------------------+
| Processes:                                                                              |
|  GPU   GI   CI              PID   Type   Process name                        GPU Memory |
|        ID   ID                                                               Usage      |
|=========================================================================================|
|  No running processes found                                                             |
+-----------------------------------------------------------------------------------------+
```

```shell
##-- device=0 은 nvidia-smi 확인 후, a30 지정
##-- sudo docker run -it --rm --gpus device=0 \
##-- --gpus all 이면, 위의 경우 두 개 장치 모두 컨테이너에 할당

sudo docker run -it --rm --gpus all \
  --shm-size=8g \
  -v /home/kcloud/nvidia-yolo/datasets:/workspace/datasets \
  -v /home/kcloud/nvidia-yolo/yolov9:/workspace/yolov9 \
  -v /home/kcloud/nvidia-yolo/venv:/workspace/venv \
  -v /home/kcloud/nvidia-yolo/logs:/workspace/yolov9/logs \
  yolov9:latest \
  bash -c "
    source /workspace/venv/bin/activate && \
    pip show ultralytics >/dev/null 2>&1 || pip install ultralytics && \
    cd /workspace/yolov9 && \
    python nvidia_e2e_val.py --simple"
```

```shell
##-- 실행 예 >
kcloud@k8s-worker1:~/nvidia-yolo/yolov9$ sudo docker run -it --rm --gpus all \
  --shm-size=8g \
  -v /home/kcloud/nvidia-yolo/datasets:/workspace/datasets \
  -v /home/kcloud/nvidia-yolo/yolov9:/workspace/yolov9 \
  -v /home/kcloud/nvidia-yolo/venv:/workspace/venv \
  -v /home/kcloud/nvidia-yolo/logs:/workspace/yolov9/logs \
  yolov9:latest \
  bash -c "
    source /workspace/venv/bin/activate && \
    pip show ultralytics >/dev/null 2>&1 || pip install ultralytics && \
    cd /workspace/yolov9 && \
    python nvidia_e2e_val.py --simple"

[2025-09-12 06:54:34] ================================================================================
[2025-09-12 06:54:34] ===== Simple Run started at 2025-09-12 06:54:34 =====
[2025-09-12 06:54:34] Full log file: /workspace/yolov9/nvidia_full_20250912_065434.log
[2025-09-12 06:54:34] Result log file: /workspace/yolov9/nvidia_result_20250912_065434.log
[2025-09-12 06:54:34] ================================================================================
[2025-09-12 06:54:34] ================================================================================
[2025-09-12 06:54:34] [device 0 : NVIDIA A30]
[2025-09-12 06:54:34] ================================================================================
[2025-09-12 06:54:34] PROCESS MODEL: yolov9c
[2025-09-12 06:59:08] RESULT yolov9c bs=1 | mAP=0.5195542629781255 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=273.45
[2025-09-12 07:01:33] RESULT yolov9c bs=4 | mAP=0.5195468467796467 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=144.93
[2025-09-12 07:03:52] RESULT yolov9c bs=8 | mAP=0.5195541129312263 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=139.69
[2025-09-12 07:06:10] RESULT yolov9c bs=16 | mAP=0.5195154961790275 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=137.45
[2025-09-12 07:08:25] RESULT yolov9c bs=32 | mAP=0.5194352019981747 target=0.47700000000000004 status=success | conf=0.025 iou=0.7 sec=134.93
[2025-09-12 07:08:25] 
[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_active | infer_only | lat_pre | lat_infer | lat_post | mAP | Target | Status | sec |
|------------|---------------------|------------|------------|---------|-----------|----------|-----|--------|--------|-----|
| 1 | 72.395 | 80.360 | 0.290 | 12.444 | 1.079 | 0.520 | 0.477 | success | 273.448 |
| 4 | 129.450 | 147.044 | 0.141 | 6.801 | 0.784 | 0.520 | 0.477 | success | 144.934 |
| 8 | 136.625 | 156.367 | 0.133 | 6.395 | 0.792 | 0.520 | 0.477 | success | 139.691 |
| 16 | 136.263 | 156.791 | 0.130 | 6.378 | 0.831 | 0.520 | 0.477 | success | 137.453 |
| 32 | 138.086 | 158.033 | 0.130 | 6.328 | 0.784 | 0.519 | 0.477 | success | 134.928 |

[2025-09-12 07:08:25] 
[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active | 72.395 | 129.450 | 136.625 | 136.263 | 138.086 |
| infer_only | 80.360 | 147.044 | 156.367 | 156.791 | 158.033 |
| lat_pre | 0.290 | 0.141 | 0.133 | 0.130 | 0.130 |
| lat_infer | 12.444 | 6.801 | 6.395 | 6.378 | 6.328 |
| lat_post | 1.079 | 0.784 | 0.792 | 0.831 | 0.784 |
| mAP | 0.520 | 0.520 | 0.520 | 0.520 | 0.519 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec | 273.448 | 144.934 | 139.691 | 137.453 | 134.928 |

[2025-09-12 07:08:25] PROCESS MODEL: yolov8n
```

#### A2(Container-Docker) 결과 

[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 82.037 | 90.748 | 0.274 | 11.020 | 0.896 | 0.518 | 0.477 | success | 228.549 |
| 4 | 129.057 | 146.703 | 0.140 | 6.816 | 0.792 | 0.518 | 0.477 | success | 151.675 |
| 8 | 136.937 | 156.504 | 0.131 | 6.390 | 0.782 | 0.518 | 0.477 | success | 146.969 |
| 16 | 136.761 | 157.539 | 0.127 | 6.348 | 0.837 | 0.518 | 0.477 | success | 145.485 |
| 32 | 138.493 | 158.738 | 0.125 | 6.300 | 0.796 | 0.518 | 0.477 | success | 142.926 |


[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.037 | 129.057 | 136.937 | 136.761 | 138.493 |
| infer_only (img/s) | 90.748 | 146.703 | 156.504 | 157.539 | 158.738 |
| lat_pre (ms) | 0.274 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 11.020 | 6.816 | 6.390 | 6.348 | 6.300 |
| lat_post (ms) | 0.896 | 0.792 | 0.782 | 0.837 | 0.796 |
| mAP | 0.518 | 0.518 | 0.518 | 0.518 | 0.518 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec (s) | 228.549 | 151.675 | 146.969 | 145.485 | 142.926 |


[model : yolov8n] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 155.156 | 196.514 | 0.253 | 5.089 | 1.104 | 0.366 | 0.336 | success | 176.154 |
| 4 | 416.141 | 732.211 | 0.139 | 1.366 | 0.898 | 0.366 | 0.336 | success | 101.862 |
| 8 | 478.981 | 924.217 | 0.131 | 1.082 | 0.875 | 0.366 | 0.336 | success | 98.393 |
| 16 | 488.780 | 992.153 | 0.127 | 1.008 | 0.911 | 0.366 | 0.336 | success | 96.500 |
| 32 | 514.177 | 1028.412 | 0.125 | 0.972 | 0.847 | 0.366 | 0.336 | success | 96.753 |


[transposed summary: model=yolov8n] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 155.156 | 416.141 | 478.981 | 488.780 | 514.177 |
| infer_only (img/s) | 196.514 | 732.211 | 924.217 | 992.153 | 1028.412 |
| lat_pre (ms) | 0.253 | 0.139 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 5.089 | 1.366 | 1.082 | 1.008 | 0.972 |
| lat_post (ms) | 1.104 | 0.898 | 0.875 | 0.911 | 0.847 |
| mAP | 0.366 | 0.366 | 0.366 | 0.366 | 0.366 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success | success |
| sec (s) | 176.154 | 101.862 | 98.393 | 96.500 | 96.753 |


[model : yolov9t] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 70.673 | 77.962 | 0.277 | 12.827 | 1.046 | 0.372 | 0.345 | success | 249.172 |
| 4 | 206.830 | 263.463 | 0.141 | 3.796 | 0.898 | 0.372 | 0.345 | success | 121.774 |
| 8 | 331.096 | 507.810 | 0.131 | 1.969 | 0.920 | 0.372 | 0.345 | success | 103.847 |
| 16 | 404.805 | 684.168 | 0.128 | 1.462 | 0.881 | 0.372 | 0.345 | success | 99.998 |
| 32 | 430.917 | 729.395 | 0.125 | 1.371 | 0.824 | 0.372 | 0.345 | success | 97.989 |


[transposed summary: model=yolov9t] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 70.673 | 206.830 | 331.096 | 404.805 | 430.917 |
| infer_only (img/s) | 77.962 | 263.463 | 507.810 | 684.168 | 729.395 |
| lat_pre (ms) | 0.277 | 0.141 | 0.131 | 0.128 | 0.125 |
| lat_infer (ms) | 12.827 | 3.796 | 1.969 | 1.462 | 1.371 |
| lat_post (ms) | 1.046 | 0.898 | 0.920 | 0.881 | 0.824 |
| mAP | 0.372 | 0.372 | 0.372 | 0.372 | 0.372 |
| Target | 0.345 | 0.345 | 0.345 | 0.345 | 0.345 |
| Status | success | success | success | success | success |
| sec (s) | 249.172 | 121.774 | 103.847 | 99.998 | 97.989 |


[model : yolov8l] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 93.446 | 104.837 | 0.274 | 9.539 | 0.889 | 0.517 | 0.476 | success | 212.220 |
| 4 | 123.343 | 139.505 | 0.140 | 7.168 | 0.799 | 0.517 | 0.476 | success | 155.534 |
| 8 | 132.513 | 150.552 | 0.131 | 6.642 | 0.773 | 0.517 | 0.476 | success | 148.660 |
| 16 | 132.843 | 151.945 | 0.127 | 6.581 | 0.819 | 0.517 | 0.476 | success | 145.835 |
| 32 | 134.513 | 152.812 | 0.125 | 6.544 | 0.765 | 0.517 | 0.476 | success | 144.374 |


[transposed summary: model=yolov8l] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 93.446 | 123.343 | 132.513 | 132.843 | 134.513 |
| infer_only (img/s) | 104.837 | 139.505 | 150.552 | 151.945 | 152.812 |
| lat_pre (ms) | 0.274 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 9.539 | 7.168 | 6.642 | 6.581 | 6.544 |
| lat_post (ms) | 0.889 | 0.799 | 0.773 | 0.819 | 0.765 |
| mAP | 0.517 | 0.517 | 0.517 | 0.517 | 0.517 |
| Target | 0.476 | 0.476 | 0.476 | 0.476 | 0.476 |
| Status | success | success | success | success | success |
| sec (s) | 212.220 | 155.534 | 148.660 | 145.835 | 144.374 |


[batch_size : 1] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 82.037 | 90.748 | 0.274 | 11.020 | 0.896 | 0.518 | 0.477 | success | 228.549 |
| yolov8n | 155.156 | 196.514 | 0.253 | 5.089 | 1.104 | 0.366 | 0.336 | success | 176.154 |
| yolov9t | 70.673 | 77.962 | 0.277 | 12.827 | 1.046 | 0.372 | 0.345 | success | 249.172 |
| yolov8l | 93.446 | 104.837 | 0.274 | 9.539 | 0.889 | 0.517 | 0.476 | success | 212.220 |


[transposed summary: batch_size=1] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.037 | 155.156 | 70.673 | 93.446 |
| infer_only (img/s) | 90.748 | 196.514 | 77.962 | 104.837 |
| lat_pre (ms) | 0.274 | 0.253 | 0.277 | 0.274 |
| lat_infer (ms) | 11.020 | 5.089 | 12.827 | 9.539 |
| lat_post (ms) | 0.896 | 1.104 | 1.046 | 0.889 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 228.549 | 176.154 | 249.172 | 212.220 |


[batch_size : 4] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 129.057 | 146.703 | 0.140 | 6.816 | 0.792 | 0.518 | 0.477 | success | 151.675 |
| yolov8n | 416.141 | 732.211 | 0.139 | 1.366 | 0.898 | 0.366 | 0.336 | success | 101.862 |
| yolov9t | 206.830 | 263.463 | 0.141 | 3.796 | 0.898 | 0.372 | 0.345 | success | 121.774 |
| yolov8l | 123.343 | 139.505 | 0.140 | 7.168 | 0.799 | 0.517 | 0.476 | success | 155.534 |


[transposed summary: batch_size=4] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 129.057 | 416.141 | 206.830 | 123.343 |
| infer_only (img/s) | 146.703 | 732.211 | 263.463 | 139.505 |
| lat_pre (ms) | 0.140 | 0.139 | 0.141 | 0.140 |
| lat_infer (ms) | 6.816 | 1.366 | 3.796 | 7.168 |
| lat_post (ms) | 0.792 | 0.898 | 0.898 | 0.799 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 151.675 | 101.862 | 121.774 | 155.534 |


[batch_size : 8] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 136.937 | 156.504 | 0.131 | 6.390 | 0.782 | 0.518 | 0.477 | success | 146.969 |
| yolov8n | 478.981 | 924.217 | 0.131 | 1.082 | 0.875 | 0.366 | 0.336 | success | 98.393 |
| yolov9t | 331.096 | 507.810 | 0.131 | 1.969 | 0.920 | 0.372 | 0.345 | success | 103.847 |
| yolov8l | 132.513 | 150.552 | 0.131 | 6.642 | 0.773 | 0.517 | 0.476 | success | 148.660 |


[transposed summary: batch_size=8] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.937 | 478.981 | 331.096 | 132.513 |
| infer_only (img/s) | 156.504 | 924.217 | 507.810 | 150.552 |
| lat_pre (ms) | 0.131 | 0.131 | 0.131 | 0.131 |
| lat_infer (ms) | 6.390 | 1.082 | 1.969 | 6.642 |
| lat_post (ms) | 0.782 | 0.875 | 0.920 | 0.773 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 146.969 | 98.393 | 103.847 | 148.660 |


[batch_size : 16] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 136.761 | 157.539 | 0.127 | 6.348 | 0.837 | 0.518 | 0.477 | success | 145.485 |
| yolov8n | 488.780 | 992.153 | 0.127 | 1.008 | 0.911 | 0.366 | 0.336 | success | 96.500 |
| yolov9t | 404.805 | 684.168 | 0.128 | 1.462 | 0.881 | 0.372 | 0.345 | success | 99.998 |
| yolov8l | 132.843 | 151.945 | 0.127 | 6.581 | 0.819 | 0.517 | 0.476 | success | 145.835 |


[transposed summary: batch_size=16] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.761 | 488.780 | 404.805 | 132.843 |
| infer_only (img/s) | 157.539 | 992.153 | 684.168 | 151.945 |
| lat_pre (ms) | 0.127 | 0.127 | 0.128 | 0.127 |
| lat_infer (ms) | 6.348 | 1.008 | 1.462 | 6.581 |
| lat_post (ms) | 0.837 | 0.911 | 0.881 | 0.819 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 145.485 | 96.500 | 99.998 | 145.835 |


[batch_size : 32] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 138.493 | 158.738 | 0.125 | 6.300 | 0.796 | 0.518 | 0.477 | success | 142.926 |
| yolov8n | 514.177 | 1028.412 | 0.125 | 0.972 | 0.847 | 0.366 | 0.336 | success | 96.753 |
| yolov9t | 430.917 | 729.395 | 0.125 | 1.371 | 0.824 | 0.372 | 0.345 | success | 97.989 |
| yolov8l | 134.513 | 152.812 | 0.125 | 6.544 | 0.765 | 0.517 | 0.476 | success | 144.374 |


[transposed summary: batch_size=32] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 138.493 | 514.177 | 430.917 | 134.513 |
| infer_only (img/s) | 158.738 | 1028.412 | 729.395 | 152.812 |
| lat_pre (ms) | 0.125 | 0.125 | 0.125 | 0.125 |
| lat_infer (ms) | 6.300 | 0.972 | 1.371 | 6.544 |
| lat_post (ms) | 0.796 | 0.847 | 0.824 | 0.765 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 142.926 | 96.753 | 97.989 | 144.374 |

#### A30(Container-Docker) 결과 

[model : yolov9c] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 82.689 | 91.906 | 0.283 | 10.881 | 0.930 | 0.518 | 0.477 | success | 253.610 |
| 4 | 129.443 | 146.866 | 0.141 | 6.809 | 0.775 | 0.518 | 0.477 | success | 149.742 |
| 8 | 136.814 | 156.318 | 0.133 | 6.397 | 0.779 | 0.518 | 0.477 | success | 143.918 |
| 16 | 136.172 | 156.391 | 0.130 | 6.394 | 0.819 | 0.518 | 0.477 | success | 142.805 |
| 32 | 138.060 | 157.725 | 0.131 | 6.340 | 0.773 | 0.518 | 0.477 | success | 141.080 |


[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.689 | 129.443 | 136.814 | 136.172 | 138.060 |
| infer_only (img/s) | 91.906 | 146.866 | 156.318 | 156.391 | 157.725 |
| lat_pre (ms) | 0.283 | 0.141 | 0.133 | 0.130 | 0.131 |
| lat_infer (ms) | 10.881 | 6.809 | 6.397 | 6.394 | 6.340 |
| lat_post (ms) | 0.930 | 0.775 | 0.779 | 0.819 | 0.773 |
| mAP | 0.518 | 0.518 | 0.518 | 0.518 | 0.518 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec (s) | 253.610 | 149.742 | 143.918 | 142.805 | 141.080 |


[model : yolov8n] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 158.860 | 202.437 | 0.264 | 4.940 | 1.091 | 0.366 | 0.336 | success | 174.841 |
| 4 | 424.184 | 749.260 | 0.140 | 1.335 | 0.883 | 0.366 | 0.336 | success | 100.011 |
| 8 | 470.899 | 917.844 | 0.131 | 1.090 | 0.903 | 0.366 | 0.336 | success | 96.656 |
| 16 | 489.838 | 983.023 | 0.127 | 1.017 | 0.897 | 0.366 | 0.336 | success | 93.790 |
| 32 | 518.038 | 1023.099 | 0.125 | 0.977 | 0.828 | 0.366 | 0.336 | success | 92.924 |


[transposed summary: model=yolov8n] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 158.860 | 424.184 | 470.899 | 489.838 | 518.038 |
| infer_only (img/s) | 202.437 | 749.260 | 917.844 | 983.023 | 1023.099 |
| lat_pre (ms) | 0.264 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 4.940 | 1.335 | 1.090 | 1.017 | 0.977 |
| lat_post (ms) | 1.091 | 0.883 | 0.903 | 0.897 | 0.828 |
| mAP | 0.366 | 0.366 | 0.366 | 0.366 | 0.366 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success | success |
| sec (s) | 174.841 | 100.011 | 96.656 | 93.790 | 92.924 |


[model : yolov9t] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 72.703 | 80.309 | 0.277 | 12.452 | 1.025 | 0.372 | 0.345 | success | 248.612 |
| 4 | 224.238 | 292.078 | 0.139 | 3.424 | 0.896 | 0.372 | 0.345 | success | 119.425 |
| 8 | 325.226 | 495.061 | 0.132 | 2.020 | 0.923 | 0.372 | 0.345 | success | 107.670 |
| 16 | 408.570 | 677.637 | 0.128 | 1.476 | 0.844 | 0.372 | 0.345 | success | 99.180 |
| 32 | 428.810 | 724.559 | 0.126 | 1.380 | 0.826 | 0.372 | 0.345 | success | 98.972 |


[transposed summary: model=yolov9t] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 72.703 | 224.238 | 325.226 | 408.570 | 428.810 |
| infer_only (img/s) | 80.309 | 292.078 | 495.061 | 677.637 | 724.559 |
| lat_pre (ms) | 0.277 | 0.139 | 0.132 | 0.128 | 0.126 |
| lat_infer (ms) | 12.452 | 3.424 | 2.020 | 1.476 | 1.380 |
| lat_post (ms) | 1.025 | 0.896 | 0.923 | 0.844 | 0.826 |
| mAP | 0.372 | 0.372 | 0.372 | 0.372 | 0.372 |
| Target | 0.345 | 0.345 | 0.345 | 0.345 | 0.345 |
| Status | success | success | success | success | success |
| sec (s) | 248.612 | 119.425 | 107.670 | 99.180 | 98.972 |


[model : yolov8l] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 93.196 | 104.654 | 0.269 | 9.555 | 0.906 | 0.517 | 0.476 | success | 215.053 |
| 4 | 123.593 | 139.556 | 0.140 | 7.166 | 0.786 | 0.517 | 0.476 | success | 154.101 |
| 8 | 131.497 | 150.569 | 0.131 | 6.641 | 0.832 | 0.517 | 0.476 | success | 148.565 |
| 16 | 132.701 | 151.832 | 0.127 | 6.586 | 0.822 | 0.517 | 0.476 | success | 145.970 |
| 32 | 134.709 | 152.961 | 0.125 | 6.538 | 0.761 | 0.517 | 0.476 | success | 144.314 |


[transposed summary: model=yolov8l] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 93.196 | 123.593 | 131.497 | 132.701 | 134.709 |
| infer_only (img/s) | 104.654 | 139.556 | 150.569 | 151.832 | 152.961 |
| lat_pre (ms) | 0.269 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 9.555 | 7.166 | 6.641 | 6.586 | 6.538 |
| lat_post (ms) | 0.906 | 0.786 | 0.832 | 0.822 | 0.761 |
| mAP | 0.517 | 0.517 | 0.517 | 0.517 | 0.517 |
| Target | 0.476 | 0.476 | 0.476 | 0.476 | 0.476 |
| Status | success | success | success | success | success |
| sec (s) | 215.053 | 154.101 | 148.565 | 145.970 | 144.314 |


[batch_size : 1] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 82.689 | 91.906 | 0.283 | 10.881 | 0.930 | 0.518 | 0.477 | success | 253.610 |
| yolov8n | 158.860 | 202.437 | 0.264 | 4.940 | 1.091 | 0.366 | 0.336 | success | 174.841 |
| yolov9t | 72.703 | 80.309 | 0.277 | 12.452 | 1.025 | 0.372 | 0.345 | success | 248.612 |
| yolov8l | 93.196 | 104.654 | 0.269 | 9.555 | 0.906 | 0.517 | 0.476 | success | 215.053 |


[transposed summary: batch_size=1] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.689 | 158.860 | 72.703 | 93.196 |
| infer_only (img/s) | 91.906 | 202.437 | 80.309 | 104.654 |
| lat_pre (ms) | 0.283 | 0.264 | 0.277 | 0.269 |
| lat_infer (ms) | 10.881 | 4.940 | 12.452 | 9.555 |
| lat_post (ms) | 0.930 | 1.091 | 1.025 | 0.906 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 253.610 | 174.841 | 248.612 | 215.053 |


[batch_size : 4] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 129.443 | 146.866 | 0.141 | 6.809 | 0.775 | 0.518 | 0.477 | success | 149.742 |
| yolov8n | 424.184 | 749.260 | 0.140 | 1.335 | 0.883 | 0.366 | 0.336 | success | 100.011 |
| yolov9t | 224.238 | 292.078 | 0.139 | 3.424 | 0.896 | 0.372 | 0.345 | success | 119.425 |
| yolov8l | 123.593 | 139.556 | 0.140 | 7.166 | 0.786 | 0.517 | 0.476 | success | 154.101 |


[transposed summary: batch_size=4] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 129.443 | 424.184 | 224.238 | 123.593 |
| infer_only (img/s) | 146.866 | 749.260 | 292.078 | 139.556 |
| lat_pre (ms) | 0.141 | 0.140 | 0.139 | 0.140 |
| lat_infer (ms) | 6.809 | 1.335 | 3.424 | 7.166 |
| lat_post (ms) | 0.775 | 0.883 | 0.896 | 0.786 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 149.742 | 100.011 | 119.425 | 154.101 |


[batch_size : 8] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 136.814 | 156.318 | 0.133 | 6.397 | 0.779 | 0.518 | 0.477 | success | 143.918 |
| yolov8n | 470.899 | 917.844 | 0.131 | 1.090 | 0.903 | 0.366 | 0.336 | success | 96.656 |
| yolov9t | 325.226 | 495.061 | 0.132 | 2.020 | 0.923 | 0.372 | 0.345 | success | 107.670 |
| yolov8l | 131.497 | 150.569 | 0.131 | 6.641 | 0.832 | 0.517 | 0.476 | success | 148.565 |


[transposed summary: batch_size=8] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.814 | 470.899 | 325.226 | 131.497 |
| infer_only (img/s) | 156.318 | 917.844 | 495.061 | 150.569 |
| lat_pre (ms) | 0.133 | 0.131 | 0.132 | 0.131 |
| lat_infer (ms) | 6.397 | 1.090 | 2.020 | 6.641 |
| lat_post (ms) | 0.779 | 0.903 | 0.923 | 0.832 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 143.918 | 96.656 | 107.670 | 148.565 |


[batch_size : 16] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 136.172 | 156.391 | 0.130 | 6.394 | 0.819 | 0.518 | 0.477 | success | 142.805 |
| yolov8n | 489.838 | 983.023 | 0.127 | 1.017 | 0.897 | 0.366 | 0.336 | success | 93.790 |
| yolov9t | 408.570 | 677.637 | 0.128 | 1.476 | 0.844 | 0.372 | 0.345 | success | 99.180 |
| yolov8l | 132.701 | 151.832 | 0.127 | 6.586 | 0.822 | 0.517 | 0.476 | success | 145.970 |


[transposed summary: batch_size=16] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.172 | 489.838 | 408.570 | 132.701 |
| infer_only (img/s) | 156.391 | 983.023 | 677.637 | 151.832 |
| lat_pre (ms) | 0.130 | 0.127 | 0.128 | 0.127 |
| lat_infer (ms) | 6.394 | 1.017 | 1.476 | 6.586 |
| lat_post (ms) | 0.819 | 0.897 | 0.844 | 0.822 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 142.805 | 93.790 | 99.180 | 145.970 |


[batch_size : 32] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9c | 138.060 | 157.725 | 0.131 | 6.340 | 0.773 | 0.518 | 0.477 | success | 141.080 |
| yolov8n | 518.038 | 1023.099 | 0.125 | 0.977 | 0.828 | 0.366 | 0.336 | success | 92.924 |
| yolov9t | 428.810 | 724.559 | 0.126 | 1.380 | 0.826 | 0.372 | 0.345 | success | 98.972 |
| yolov8l | 134.709 | 152.961 | 0.125 | 6.538 | 0.761 | 0.517 | 0.476 | success | 144.314 |


[transposed summary: batch_size=32] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 138.060 | 518.038 | 428.810 | 134.709 |
| infer_only (img/s) | 157.725 | 1023.099 | 724.559 | 152.961 |
| lat_pre (ms) | 0.131 | 0.125 | 0.126 | 0.125 |
| lat_infer (ms) | 6.340 | 0.977 | 1.380 | 6.538 |
| lat_post (ms) | 0.773 | 0.828 | 0.826 | 0.761 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 141.080 | 92.924 | 98.972 | 144.314 

## 4.2 Kubernetes (TBD)

### 이미지 생성 (TBD)

### 실행 및 결과 확인 (TBD)

--- 

# 5. 시험 결과 모음

## Baremetal

### 조건  

📗 yolov8n, yolov8l, yolov9t, yolov9c  

- input size: 640 X 640  
- 신뢰도 임계값: 0.025, iou 임계값: 0.7  
- batch size: [1, 4, 8, 16, 32]  
- Warboy  
    - .pt ➡️ onnx(FP32) ➡️ onnx_i8(INT8) ➡️ ENF (Warboy Runtime Binary)  
    - warboy-vision-models Repo. 수정  
        - Pre, Post 지연시간 측정 코드 추가   
        - Batch Size 별 ENF 생성  
        - Batch Size 별 추론 수행 코드 추가  
- NVIDIA (A2)  
    - .pt ➡️ Pytorch, FP32  
    - yolov9 Repo. 수정  
        - Pre, Post 지연시간 측정 코드 추가  
        - benchmarks (지연시간) + val (정확도) = e2e_val (두 파일을 실행하여 지연시간, 정확도 결과 추출)  

📘 Yolov9 Repo. 기반으로 Yolov8 모델 추론을 수행하여도 동작 및 결과 추출에 관계 없음   

- 📕 e2e_wall_per_image (imgs/s)  
    - warboy의 경우 pipeline 밖에서 측정하면, 정확한 시간 측정이 어려움 (큐, 대기시간 등 어떤 시간이 소모되는지 알 수 없음)  
        - 따라서, 이 메트릭은 측정항목에서 제외
    - **이미지 당** 엔드-투-엔드(Pre+Infer+Post) 처리량으로 값이 클수록 좋다.  
    - `img/s = 1000 / (엔드-투-엔드 평균 지연(ms))`  
- e2e_active (imgs/s)  
    - 장치가 실제로 작업 중(active) 이었을 때,기준의 엔드-투-엔드(Pre+Infer+Post) 처리량으로 값이 클수록 좋다.  
    - e2e_wall_per_image와 대체로 비슷  
        - nvidia는 `e2e_wall_per_image`와 동일 값  
        - warboy는 `throughput_img_per_s.e2e_active`와 동일 값  
- infer_only (imgs/s)  
    - **추론(inference) 단계** 만의 per-image 처리량. Pre/NMS 등은 제외.   값이 클수록 좋다.
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
    - 전체 실행의 경과 시간  
    - 한 모델, 배치조합에 대한 벤치마크, 정확도 검증까지 포함한 총 시간  


📗 Warboy vs NVIDIA — 실행 방식 대응 관계

| 단계 | Warboy 코드 | NVIDIA yolov9 확장 코드 | 대응 설명 |
|-----|-------------|-------------------------|----------|
| 입력/디코딩 | `ImageListDecoder` / `VideoDecoder` (멀티프로세스) → `frame_mux`에 raw 이미지+context 투입 | `create_dataloader()` (PyTorch DataLoader, worker들이 파일 읽기+리사이즈) | 둘 다 COCO val2017에서 이미지를 불러오고 전처리. Warboy는 custom 프로세스+큐, NVIDIA는 DataLoader |
| 전처리     | `YoloPreProcessor` (리사이즈, normalize, padding) → `frame_mux`에 tensor 저장 | `val.py`: `im = im.to(device)` → `im = im.half() if half else im.float()` → `im /= 255.0` | 같은 역할. Warboy는 프로세스+큐, NVIDIA는 dataloader 안과 val.py 루프에서 GPU 텐서 변환 |
| 추론 실행  | `WarboyApplication` (NPU runtime, ENF 모델 실행) → `output_mux`로 feature map 출력 | `val.py`: `preds = model(im)` (PyTorch forward, GPU CUDA 실행) | 차이: Warboy는 ENF→NPU 런타임, NVIDIA는 PyTorch 모델→GPU CUDA |
| 후처리     | `ImageEncoder` / `PredictionEncoder` (NMS 포함 postprocess 함수 호출)<br>【pipeline_process.py / image_encoder.py】 | `val.py`: `non_max_suppression(preds, conf_thres, iou_thres, ...)` | 동일: bounding box filtering & NMS |
| 타이밍 기록 | `image_decoder`에서 t0, `warboy_runtime`에서 infer, `image_encoder`에서 post, e2e_active, e2e_wall 기록 | `val.py`: `dt[0]`, `dt[1]`, `dt[2]` 프로파일러로 pre/infer/nms ms 기록 | 같은 지표 기록. Warboy는 큐 기반 시각, NVIDIA는 context manager(Profile)로 구간 ms 기록 |
| 정확도 평가 | `_process_outputs` + `COCOeval`  | `pycocotools.COCOeval`  | 동일하게 COCO API 사용 |
| 벤치마크   | `object_det.py`에서 summary dict: throughput_img_per_s, latency_ms, mAP      | `benchmarks.py`에서 pre/inf/nms 리스트 수집 + `nvidia_e2e_val.py`에서 throughput/img/s 계산 | 최종 산출 지표 구조 동일 |
| 결과 출력  | `run_performance_suite.py`: Markdown 표 (모델별/배치별)                       | `nvidia_e2e_val.py`: Markdown 표 (모델별/배치별)                                         | 출력 포맷 동일 |

### 모델별(NVIDIA A30)

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


### 배치사이즈별(NVIDIA A30)

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



### 모델별(NVIDIA A2)

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



### 배치사이즈별(NVIDIA A2)

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

### 모델별(Warboy)

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



### 배치사이즈별(Warboy)

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



## Baremetal (장치간 비교)

### Latency 

[lat_infer per batch size]

| Batch Size | Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- | --- |
| 1 | Warboy | 10.815 | 34.374 | 11.410 | 25.438 |
| 1 | NVIDIA A2 | 5.085 | 9.507 | 12.409 | 10.786 |
| 1 | NVIDIA A30 | 4.913 | 9.507 | 12.434 | 11.575 |
| 4 | Warboy | 9.363 | NA | 9.189 | NA |
| 4 | NVIDIA A2 | 1.366 | 7.153 | 3.693 | 6.809 |
| 4 | NVIDIA A30 | 1.329 | 7.160 | 3.568 | 6.796 |
| 8 | Warboy | 12.073 | NA | 12.471 | NA |
| 8 | NVIDIA A2 | 1.366 | 7.153 | 3.693 | 6.809 |
| 8 | NVIDIA A30 | 1.085 | 6.631 | 1.955 | 6.385 |
| 16 | Warboy | 10.310 | NA | NA | NA |
| 16 | NVIDIA A2 | 1.022 | 6.570 | 1.461 | 6.335 |
| 16 | NVIDIA A30 | 1.015 | 6.617 | 1.525 | 6.369 |
| 32 | Warboy | NA | NA | NA | NA |
| 32 | NVIDIA A2 | 0.977 | 6.518 | 1.376 | 6.285 |
| 32 | NVIDIA A30 | 0.980 | 6.515 | 1.374 | 6.321 |

### Throughput


[infer_only per batch size]

| Batch Size | Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- | --- |
| 1 | Warboy | 92.467 | 29.092 | 87.646 | 39.311 |
| 1 | NVIDIA A2 | 196.675 | 105.184 | 80.589 | 92.713 |
| 1 | NVIDIA A30 | 203.524 | 105.190 | 80.423 | 86.395 |
| 4 | Warboy | 106.798 | NA | 108.827 | NA |
| 4 | NVIDIA A2 | 732.066 | 139.811 | 270.764 | 146.862 |
| 4 | NVIDIA A30 | 752.725 | 139.671 | 280.232 | 147.151 |
| 8 | Warboy | 82.832 | NA | 80.186 | NA |
| 8 | NVIDIA A2 | 732.066 | 139.811 | 270.764 | 146.862 |
| 8 | NVIDIA A30 | 922.031 | 150.800 | 511.593 | 156.617 |
| 16 | Warboy | 96.997 | NA | NA | NA |
| 16 | NVIDIA A2 | 978.221 | 152.218 | 684.574 | 157.846 |
| 16 | NVIDIA A30 | 985.532 | 151.121 | 655.683 | 157.012 |
| 32 | Warboy | NA | NA | NA | NA |
| 32 | NVIDIA A2 | 1024.024 | 153.415 | 726.607 | 159.113 |
| 32 | NVIDIA A30 | 1019.979 | 153.498 | 727.838 | 158.203 |



### Latency (배치사이즈별)

[batch size = 1, lat_infer]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 10.815 | 34.374 | 11.410 | 25.438 |
| NVIDIA A2 | 5.085 | 9.507 | 12.409 | 10.786 |
| NVIDIA A30 | 4.913 | 9.507 | 12.434 | 11.575 |

[batch size = 4, lat_infer]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 9.363 | NA | 9.189 | NA |
| NVIDIA A2 | 1.366 | 7.153 | 3.693 | 6.809 |
| NVIDIA A30 | 1.329 | 7.160 | 3.568 | 6.796 |

[batch size = 8, lat_infer]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 12.073 | NA | 12.471 | NA |
| NVIDIA A2 | 1.366 | 7.153 | 3.693 | 6.809 |
| NVIDIA A30 | 1.085 | 6.631 | 1.955 | 6.385 |

[batch size = 16, lat_infer]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 10.310 | NA | NA | NA |
| NVIDIA A2 | 1.022 | 6.570 | 1.461 | 6.335 |
| NVIDIA A30 | 1.015 | 6.617 | 1.525 | 6.369 |


### Throughput (배치사이즈별)

[batch size = 1, infer_only]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 92.467 | 29.092 | 87.646 | 39.311 |
| NVIDIA A2 | 196.675 | 105.184 | 80.589 | 92.713 |
| NVIDIA A30 | 203.524 | 105.190 | 80.423 | 86.395 |

[batch size = 4, infer_only]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 106.798 | NA | 108.827 | NA |
| NVIDIA A2 | 732.066 | 139.811 | 270.764 | 146.862 |
| NVIDIA A30 | 752.725 | 139.671 | 280.232 | 147.151 |

[batch size = 8, infer_only]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 82.832 | NA | 80.186 | NA |
| NVIDIA A2 | 732.066 | 139.811 | 270.764 | 146.862 |
| NVIDIA A30 | 922.031 | 150.800 | 511.593 | 156.617 |

[batch size = 16, infer_only]

| Device / Models | yolov8n | yolov8l | yolov9t | yolov9c |
| --- | --- | --- | --- | --- |
| Warboy | 96.997 | NA | NA | NA |
| NVIDIA A2 | 978.221 | 152.218 | 684.574 | 157.846 |
| NVIDIA A30 | 985.532 | 151.121 | 655.683 | 157.012 |


## Docker-Container

### NVIDIA(A2, A30)

#### 모델별(A30)

[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.689 | 129.443 | 136.814 | 136.172 | 138.060 |
| infer_only (img/s) | 91.906 | 146.866 | 156.318 | 156.391 | 157.725 |
| lat_pre (ms) | 0.283 | 0.141 | 0.133 | 0.130 | 0.131 |
| lat_infer (ms) | 10.881 | 6.809 | 6.397 | 6.394 | 6.340 |
| lat_post (ms) | 0.930 | 0.775 | 0.779 | 0.819 | 0.773 |
| mAP | 0.518 | 0.518 | 0.518 | 0.518 | 0.518 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec (s) | 253.610 | 149.742 | 143.918 | 142.805 | 141.080 |


[transposed summary: model=yolov8n] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 158.860 | 424.184 | 470.899 | 489.838 | 518.038 |
| infer_only (img/s) | 202.437 | 749.260 | 917.844 | 983.023 | 1023.099 |
| lat_pre (ms) | 0.264 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 4.940 | 1.335 | 1.090 | 1.017 | 0.977 |
| lat_post (ms) | 1.091 | 0.883 | 0.903 | 0.897 | 0.828 |
| mAP | 0.366 | 0.366 | 0.366 | 0.366 | 0.366 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success | success |
| sec (s) | 174.841 | 100.011 | 96.656 | 93.790 | 92.924 |


[transposed summary: model=yolov9t] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 72.703 | 224.238 | 325.226 | 408.570 | 428.810 |
| infer_only (img/s) | 80.309 | 292.078 | 495.061 | 677.637 | 724.559 |
| lat_pre (ms) | 0.277 | 0.139 | 0.132 | 0.128 | 0.126 |
| lat_infer (ms) | 12.452 | 3.424 | 2.020 | 1.476 | 1.380 |
| lat_post (ms) | 1.025 | 0.896 | 0.923 | 0.844 | 0.826 |
| mAP | 0.372 | 0.372 | 0.372 | 0.372 | 0.372 |
| Target | 0.345 | 0.345 | 0.345 | 0.345 | 0.345 |
| Status | success | success | success | success | success |
| sec (s) | 248.612 | 119.425 | 107.670 | 99.180 | 98.972 |


[transposed summary: model=yolov8l] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 93.196 | 123.593 | 131.497 | 132.701 | 134.709 |
| infer_only (img/s) | 104.654 | 139.556 | 150.569 | 151.832 | 152.961 |
| lat_pre (ms) | 0.269 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 9.555 | 7.166 | 6.641 | 6.586 | 6.538 |
| lat_post (ms) | 0.906 | 0.786 | 0.832 | 0.822 | 0.761 |
| mAP | 0.517 | 0.517 | 0.517 | 0.517 | 0.517 |
| Target | 0.476 | 0.476 | 0.476 | 0.476 | 0.476 |
| Status | success | success | success | success | success |
| sec (s) | 215.053 | 154.101 | 148.565 | 145.970 | 144.314 |


#### 배치사이즈별(A30)  


[transposed summary: batch_size=1] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.689 | 158.860 | 72.703 | 93.196 |
| infer_only (img/s) | 91.906 | 202.437 | 80.309 | 104.654 |
| lat_pre (ms) | 0.283 | 0.264 | 0.277 | 0.269 |
| lat_infer (ms) | 10.881 | 4.940 | 12.452 | 9.555 |
| lat_post (ms) | 0.930 | 1.091 | 1.025 | 0.906 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 253.610 | 174.841 | 248.612 | 215.053 |


[transposed summary: batch_size=4] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 129.443 | 424.184 | 224.238 | 123.593 |
| infer_only (img/s) | 146.866 | 749.260 | 292.078 | 139.556 |
| lat_pre (ms) | 0.141 | 0.140 | 0.139 | 0.140 |
| lat_infer (ms) | 6.809 | 1.335 | 3.424 | 7.166 |
| lat_post (ms) | 0.775 | 0.883 | 0.896 | 0.786 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 149.742 | 100.011 | 119.425 | 154.101 |


[transposed summary: batch_size=8] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.814 | 470.899 | 325.226 | 131.497 |
| infer_only (img/s) | 156.318 | 917.844 | 495.061 | 150.569 |
| lat_pre (ms) | 0.133 | 0.131 | 0.132 | 0.131 |
| lat_infer (ms) | 6.397 | 1.090 | 2.020 | 6.641 |
| lat_post (ms) | 0.779 | 0.903 | 0.923 | 0.832 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 143.918 | 96.656 | 107.670 | 148.565 |


[transposed summary: batch_size=16] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.172 | 489.838 | 408.570 | 132.701 |
| infer_only (img/s) | 156.391 | 983.023 | 677.637 | 151.832 |
| lat_pre (ms) | 0.130 | 0.127 | 0.128 | 0.127 |
| lat_infer (ms) | 6.394 | 1.017 | 1.476 | 6.586 |
| lat_post (ms) | 0.819 | 0.897 | 0.844 | 0.822 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 142.805 | 93.790 | 99.180 | 145.970 |


[transposed summary: batch_size=32] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 138.060 | 518.038 | 428.810 | 134.709 |
| infer_only (img/s) | 157.725 | 1023.099 | 724.559 | 152.961 |
| lat_pre (ms) | 0.131 | 0.125 | 0.126 | 0.125 |
| lat_infer (ms) | 6.340 | 0.977 | 1.380 | 6.538 |
| lat_post (ms) | 0.773 | 0.828 | 0.826 | 0.761 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 141.080 | 92.924 | 98.972 | 144.314 |


#### 모델별(A2)

[transposed summary: model=yolov9c] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.037 | 129.057 | 136.937 | 136.761 | 138.493 |
| infer_only (img/s) | 90.748 | 146.703 | 156.504 | 157.539 | 158.738 |
| lat_pre (ms) | 0.274 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 11.020 | 6.816 | 6.390 | 6.348 | 6.300 |
| lat_post (ms) | 0.896 | 0.792 | 0.782 | 0.837 | 0.796 |
| mAP | 0.518 | 0.518 | 0.518 | 0.518 | 0.518 |
| Target | 0.477 | 0.477 | 0.477 | 0.477 | 0.477 |
| Status | success | success | success | success | success |
| sec (s) | 228.549 | 151.675 | 146.969 | 145.485 | 142.926 |

[transposed summary: model=yolov8n] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 155.156 | 416.141 | 478.981 | 488.780 | 514.177 |
| infer_only (img/s) | 196.514 | 732.211 | 924.217 | 992.153 | 1028.412 |
| lat_pre (ms) | 0.253 | 0.139 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 5.089 | 1.366 | 1.082 | 1.008 | 0.972 |
| lat_post (ms) | 1.104 | 0.898 | 0.875 | 0.911 | 0.847 |
| mAP | 0.366 | 0.366 | 0.366 | 0.366 | 0.366 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success | success |
| sec (s) | 176.154 | 101.862 | 98.393 | 96.500 | 96.753 |


[transposed summary: model=yolov9t] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 70.673 | 206.830 | 331.096 | 404.805 | 430.917 |
| infer_only (img/s) | 77.962 | 263.463 | 507.810 | 684.168 | 729.395 |
| lat_pre (ms) | 0.277 | 0.141 | 0.131 | 0.128 | 0.125 |
| lat_infer (ms) | 12.827 | 3.796 | 1.969 | 1.462 | 1.371 |
| lat_post (ms) | 1.046 | 0.898 | 0.920 | 0.881 | 0.824 |
| mAP | 0.372 | 0.372 | 0.372 | 0.372 | 0.372 |
| Target | 0.345 | 0.345 | 0.345 | 0.345 | 0.345 |
| Status | success | success | success | success | success |
| sec (s) | 249.172 | 121.774 | 103.847 | 99.998 | 97.989 |


[transposed summary: model=yolov8l] : conf (0.025), iou (0.700)

| batch_size | 1 | 4 | 8 | 16 | 32 |
| --- | --- | --- | --- | --- | --- |
| e2e_active (img/s) | 93.446 | 123.343 | 132.513 | 132.843 | 134.513 |
| infer_only (img/s) | 104.837 | 139.505 | 150.552 | 151.945 | 152.812 |
| lat_pre (ms) | 0.274 | 0.140 | 0.131 | 0.127 | 0.125 |
| lat_infer (ms) | 9.539 | 7.168 | 6.642 | 6.581 | 6.544 |
| lat_post (ms) | 0.889 | 0.799 | 0.773 | 0.819 | 0.765 |
| mAP | 0.517 | 0.517 | 0.517 | 0.517 | 0.517 |
| Target | 0.476 | 0.476 | 0.476 | 0.476 | 0.476 |
| Status | success | success | success | success | success |
| sec (s) | 212.220 | 155.534 | 148.660 | 145.835 | 144.374 |



#### 배치사이즈별(A2)  

[transposed summary: batch_size=1] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 82.037 | 155.156 | 70.673 | 93.446 |
| infer_only (img/s) | 90.748 | 196.514 | 77.962 | 104.837 |
| lat_pre (ms) | 0.274 | 0.253 | 0.277 | 0.274 |
| lat_infer (ms) | 11.020 | 5.089 | 12.827 | 9.539 |
| lat_post (ms) | 0.896 | 1.104 | 1.046 | 0.889 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 228.549 | 176.154 | 249.172 | 212.220 |


[transposed summary: batch_size=4] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 129.057 | 416.141 | 206.830 | 123.343 |
| infer_only (img/s) | 146.703 | 732.211 | 263.463 | 139.505 |
| lat_pre (ms) | 0.140 | 0.139 | 0.141 | 0.140 |
| lat_infer (ms) | 6.816 | 1.366 | 3.796 | 7.168 |
| lat_post (ms) | 0.792 | 0.898 | 0.898 | 0.799 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 151.675 | 101.862 | 121.774 | 155.534 |


[transposed summary: batch_size=8] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.937 | 478.981 | 331.096 | 132.513 |
| infer_only (img/s) | 156.504 | 924.217 | 507.810 | 150.552 |
| lat_pre (ms) | 0.131 | 0.131 | 0.131 | 0.131 |
| lat_infer (ms) | 6.390 | 1.082 | 1.969 | 6.642 |
| lat_post (ms) | 0.782 | 0.875 | 0.920 | 0.773 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 146.969 | 98.393 | 103.847 | 148.660 |


[transposed summary: batch_size=16] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 136.761 | 488.780 | 404.805 | 132.843 |
| infer_only (img/s) | 157.539 | 992.153 | 684.168 | 151.945 |
| lat_pre (ms) | 0.127 | 0.127 | 0.128 | 0.127 |
| lat_infer (ms) | 6.348 | 1.008 | 1.462 | 6.581 |
| lat_post (ms) | 0.837 | 0.911 | 0.881 | 0.819 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 145.485 | 96.500 | 99.998 | 145.835 |


[transposed summary: batch_size=32] : conf (0.025), iou (0.700)

| models | yolov9c | yolov8n | yolov9t | yolov8l |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 138.493 | 514.177 | 430.917 | 134.513 |
| infer_only (img/s) | 158.738 | 1028.412 | 729.395 | 152.812 |
| lat_pre (ms) | 0.125 | 0.125 | 0.125 | 0.125 |
| lat_infer (ms) | 6.300 | 0.972 | 1.371 | 6.544 |
| lat_post (ms) | 0.796 | 0.847 | 0.824 | 0.765 |
| mAP | 0.518 | 0.366 | 0.372 | 0.517 |
| Target | 0.477 | 0.336 | 0.345 | 0.476 |
| Status | success | success | success | success |
| sec (s) | 142.926 | 96.753 | 97.989 | 144.374 |


### Warboy

#### 모델별(Warboy)

[transposed summary: model=yolov8l, conf (0.025), iou (0.700)]

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 22.742 |
| infer_only (img/s) | 29.434 |
| lat_pre (ms) | 1.590 |
| lat_infer (ms) | 33.974 |
| lat_post (ms) | 8.409 |
| mAP | 0.495 |
| Target | 0.476 |
| Status | success |
| sec (s) | 201.550 |


[transposed summary: model=yolov8n, conf (0.025), iou (0.700)]

| batch_size | 1 | 4 | 8 | 16 |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 58.793 | 67.207 | 56.902 | 62.647 |
| infer_only (img/s) | 91.406 | 108.125 | 82.518 | 95.791 |
| lat_pre (ms) | 1.329 | 1.139 | 1.109 | 1.093 |
| lat_infer (ms) | 10.940 | 9.249 | 12.119 | 10.439 |
| lat_post (ms) | 4.740 | 4.492 | 4.346 | 4.430 |
| mAP | 0.345 | 0.345 | 0.345 | 0.345 |
| Target | 0.336 | 0.336 | 0.336 | 0.336 |
| Status | success | success | success | success |
| sec (s) | 82.110 | 68.970 | 84.050 | 72.080 |


[transposed summary: model=yolov9c, conf (0.025), iou (0.700)]

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 28.165 |
| infer_only (img/s) | 39.122 |
| lat_pre (ms) | 1.689 |
| lat_infer (ms) | 25.561 |
| lat_post (ms) | 8.255 |
| mAP | 0.497 |
| Target | 0.477 |
| Status | success |
| sec (s) | 157.310 |


[transposed summary: model=yolov9t, conf (0.025), iou (0.700)]

| batch_size | 1 | 4 | 8 |
| --- | --- | --- | --- |
| e2e_active (img/s) | 55.915 | 66.682 | 57.133 |
| infer_only (img/s) | 85.805 | 106.741 | 84.800 |
| lat_pre (ms) | 1.366 | 1.150 | 1.085 |
| lat_infer (ms) | 11.654 | 9.369 | 11.792 |
| lat_post (ms) | 4.864 | 4.478 | 4.625 |
| mAP | 0.349 | 0.349 | 0.349 |
| Target | 0.345 | 0.345 | 0.345 |
| Status | success | success | success |
| sec (s) | 85.200 | 69.030 | 80.250 |



#### 배치사이즈별(Warboy)  

[transposed summary: batch_size=1, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | 22.742 | 58.793 | 28.165 | 55.915 |
| infer_only (img/s) | 29.434 | 91.406 | 39.122 | 85.805 |
| lat_pre (ms) | 1.590 | 1.329 | 1.689 | 1.366 |
| lat_infer (ms) | 33.974 | 10.940 | 25.561 | 11.654 |
| lat_post (ms) | 8.409 | 4.740 | 8.255 | 4.864 |
| mAP | 0.495 | 0.345 | 0.497 | 0.349 |
| Target | 0.476 | 0.336 | 0.477 | 0.345 |
| Status | success | success | success | success |
| sec (s) | 201.550 | 82.110 | 157.310 | 85.200 |


[transposed summary: batch_size=4, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 67.207 | NA | 66.682 |
| infer_only (img/s) | NA | 108.125 | NA | 106.741 |
| lat_pre (ms) | NA | 1.139 | NA | 1.150 |
| lat_infer (ms) | NA | 9.249 | NA | 9.369 |
| lat_post (ms) | NA | 4.492 | NA | 4.478 |
| mAP | NA | 0.345 | NA | 0.349 |
| Target | NA | 0.336 | NA | 0.345 |
| Status | NA | success | NA | success |
| sec (s) | NA | 68.970 | NA | 69.030 |

[transposed summary: batch_size=8, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 56.902 | NA | 57.133 |
| infer_only (img/s) | NA | 82.518 | NA | 84.800 |
| lat_pre (ms) | NA | 1.109 | NA | 1.085 |
| lat_infer (ms) | NA | 12.119 | NA | 11.792 |
| lat_post (ms) | NA | 4.346 | NA | 4.625 |
| mAP | NA | 0.345 | NA | 0.349 |
| Target | NA | 0.336 | NA | 0.345 |
| Status | NA | success | NA | success |
| sec (s) | NA | 84.050 | NA | 80.250 |

[transposed summary: batch_size=16, conf (0.025), iou (0.700)]

| models | yolov8l | yolov8n | yolov9c | yolov9t |
| --- | --- | --- | --- | --- |
| e2e_active (img/s) | NA | 62.647 | NA | NA |
| infer_only (img/s) | NA | 95.791 | NA | NA |
| lat_pre (ms) | NA | 1.093 | NA | NA |
| lat_infer (ms) | NA | 10.439 | NA | NA |
| lat_post (ms) | NA | 4.430 | NA | NA |
| mAP | NA | 0.345 | NA | NA |
| Target | NA | 0.336 | NA | NA |
| Status | NA | success | NA | NA |
| sec (s) | NA | 72.080 | NA | NA |



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

