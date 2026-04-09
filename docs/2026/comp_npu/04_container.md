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
