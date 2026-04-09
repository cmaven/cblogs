
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
