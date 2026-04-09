
# Warboy 수정 코드 동작

## 요약

run_performance_suite.py는 
- (ENF가 있는 YOLO 계열 모델들을 자동 발견) → 
- (batch size별로 warboy-vision model-performance 실행) → 
- (Pipeline: preprocess → Warboy infer → postprocess)로 COCO val2017 전체를 돌려 pre/infer/post/e2e latency & throughput을 JSON으로 출력
- COCOeval로 mAP까지 계산한 뒤, 그 stdout을 다시 파싱해 마크다운 표 형태로 로그 파일에 요약하는 코드

> Coco Dataset 5,000장에 대한 Object Detection 추론 수행
> 기본 Warboy-vision-model의 정확도(mAP) 뿐만 아니라 Latency 측정  


## 1) run_performance_suite.py: 무엇을 자동으로 돌리나?

### 1-1. 모델/배치 자동 탐색

- ../models/enf/object_detection/*.enf를 스캔해서 “모델 base 이름”을 수집합니다. 예: yolov9t.enf, yolov9t_4b.enf, yolov9t_8b.enf → base는 yolov9t 

배치 파일 네이밍은 아래처럼 고정 매핑입니다. 
- bs=1: {model}.enf
- bs=4: {model}_4b.enf
- bs=8: {model}_8b.enf … (16/32도 동일 패턴)

즉, 어떤 모델이든 ENF가 존재하는 batch size만 골라 테스트합니다.

### 1-2. config YAML 자동 생성/확인

항상 tutorials/cfg/`<model>`.yaml을 사용하며, 없으면 자동으로 생성합니다. 

생성되는 YAML에는:
- task: object_detection
- input_shape: [1,3,640,640]
- conf_thres: 0.025, iou_thres: 0.7
- calibration_data: ../datasets/coco/val2017, num_calibration_data: 100
- class_names: COCO 80 classes  

등이 들어갑니다. 

## 2) 실제 실행되는 커맨드: warboy-vision model-performance

각 (모델, 배치)에 대해 아래를 실행합니다. 

```shell
warboy-vision model-performance --config_file tutorials/cfg/<base>.yaml --batch-size <bs>
```  

이 CLI 엔트리는 run_test_scenarios.py의 run_e2e_test()로 연결되고, config의 task가 object_detection이면 object_det.test_warboy_yolo_performance_det를 실행합니다. 

또한 COCO 경로는 기본으로:
- 이미지: ../datasets/coco/val2017  
- 어노테이션: ../datasets/coco/annotations/instances_val2017.json  

을 사용합니다. 

## 3) Warboy에서 COCO Object Detection을 “어떤 과정”으로 수행하나?

Object detection 성능 테스트 함수는 test_warboy_yolo_performance_det()이고, 핵심은:

### 3-1. ENF 선택 (배치별 ENF)

- use_enf=True이면 ENF를 사용합니다.
- bs=1이면 ../models/enf/object_detection/`<model>`.enf, bs>1이면 `<model>`_`<bs>`b.enf를 찾습니다. 없으면 에러. 

### 3-2. 데이터 준비 (val2017 전체)

- image_dir의 파일을 전부 읽어 Image(image_info=`<path>`) 리스트로 만듭니다. (val2017이면 5,000장) 
- Preprocess는 YoloPreProcessor(new_shape=..., tensor_type="uint8") 기반입니다. 

### 3-3. 멀티프로세스 Pipeline 구성 (Decoder → Runtime → Encoder)

여기서부터가 “E2E 측정의 진짜 핵심 구조”입니다.

(1) ImageListDecoder 프로세스 (Preprocess)  

- cv2.imread()로 이미지 읽고
- YoloPreProcessor(img) 수행
- stream_mux에는 (input_tensor, img_idx), frame_mux에는 (orig_img, context, img_idx)를 넣습니다.
- 그리고 timings dict에 pre ms 및 t0(wall 기준 시작)도 기록합니다. 

(2) WarboyApplication 프로세스 (Inference on NPU)  

- ENF면 FuriosaRTModelConfig(name="YOLO", model=`<enf>`, worker_num, npu_device)로 로드합니다. (ONNX면 compile 경로로 들어가지만, suite는 ENF 위주) 
- batch_size==1이면, 이미지 1장씩 model.predict(input_) 실행하고 infer ms 및 t2를 timings에 기록합니다. 
- batch_size>1이면, 입력을 np.concatenate로 (B,C,H,W)로 묶어 predict하고, 출력을 per-image 형태로 “postprocessor가 기대하는 모양”으로 다시 쪼개서 output_mux로 1장씩 내보냅니다(또는 패딩 배치 처리). 

(3) PredictionEncoder 프로세스 (Postprocess + e2e 계산)

- postprocessor(output, context, frame.shape[:2])로 bbox/score/class 결과를 생성합니다.
- timings에 post ms를 넣고, e2e_active = pre + infer + post를 계산합니다.
- 그리고 e2e_wall = (현재시간 - t0)로 “실제 wall-clock end-to-end”도 기록합니다. 
- E2E 테스트 모드에서는 ImageHandler가 result_mux에서 (preds, _, img_idx)를 받아 task.outputs[image_path] = [pred_array] 형태로 누적합니다. 


요약하면, pre/infer/post는 각 프로세스가 각각 재서 timings에 합쳐지고, e2e_active(순수 처리시간 합)와 e2e_wall(큐잉/스케줄링 포함 wall시간)이 둘 다 뽑힙니다.

## 4) 어떤 “결과”를 출력하나?

### 4-1. 1차 출력: 성능 JSON (stdout)

추론이 끝나면 Inference Done in XX.XX sec를 찍고, timings를 모아서 아래 JSON을 print(json.dumps(summary, indent=2))로 출력합니다. 

- throughput_img_per_s
    - e2e_active: 1000 / avg(e2e_active_ms)
    - infer_only: 1000 / avg(infer_ms)
    - e2e_wall_per_image: 1000 / avg(e2e_wall_ms)
- latency_ms
    - pre/infer/post/e2e_active/e2e_wall 각각 avg, p50
- dataset_img_per_s.throughput_wall
    - 전체 이미지 수 / 전체 wall time (suite 밖에서 측정한 task.run() 전체 시간) 

### 4-2. 2차 출력: COCO mAP (COCOeval summarize)

- task.outputs에 모인 detection 결과를 COCO 포맷으로 변환하고 COCOeval로 mAP를 평가합니다. 
- pycocotools.cocoeval.COCOeval(...).summarize()가 표준 COCO metrics 테이블을 stdout으로 출력합니다. 
- 그리고 Accuracy check success/failed를 출력합니다. 기준은 TARGET_ACCURACY[model_name] * 0.9 입니다. 

### 4-3. suite가 추가로 하는 일: stdout 파싱 → 마크다운 요약표 생성

- run_performance_suite.py는 위 stdout에서: JSON 블록(throughput_img_per_s 포함)을 찾아 파싱하고 
- Inference Done in ... sec, Accuracy check ... mAP ... Target ...도 정규식으로 추가 파싱해서 result["metrics"]에 저장합니다. 
- 그리고 “모델별 표 / 배치별 표 / 전치(transposed) 표”를 만들어
    - performance_full_`<timestamp>`.log (전체)
    - performance_result_`<timestamp>`.log (요약) 에 기록합니다. 

--- 

# NVIDIA 수정 코드 동작

## 요약

nvidia_e2e_val.py --simple은 
- (1) val.py(task=speed)로 COCO를 돌리며 pre/infer/NMS 시간을 per-image 리스트로 모아 처리량/지연을 계산하고, 
- (2) val.py(task=val, save_json=True)+pycocotools로 COCO mAP를 계산한 다음, 
- (3) 그 결과를 JSON + RESULT 한 줄 + 마크다운 표(모델/배치별)로 콘솔 및 로그 파일에 출력하는 코드입니다.

> Coco Dataset 5,000장에 대한 Object Detection 추론 수행
> 기본 yolov9의 정확도(mAP) 뿐만 아니라 Latency 측정  

## 1) --simple 모드에서 무엇을 반복 실행하나?

--simple이면 스크립트가 자동으로:
- GPU 개수만큼(torch.cuda.device_count()) 디바이스를 순회하고 
- weights/ 폴더의 *.pt를 전부 모아서(예: yolov9t.pt, yolov9s.pt …)
- 배치 사이즈를 BATCH_SIZES = [1,4,8,16,32]로 바꿔가며 
- 각 조합마다 run_e2e()를 호출해 결과를 누적하고, 모델별/배치별 요약표를 출력/저장합니다. 
- 로그 파일도 2개를 자동 생성합니다:
    - nvidia_full_`<timestamp>`.log
    - nvidia_result_`<timestamp>`.log 

## 2) 각 (GPU, weight, batch) 조합에서 “COCO Object Detection”은 어떤 과정으로 수행되나?

핵심은 run_e2e() 내부가 2단계로 나뉜다는 점이에요.

### (A) “마이크로 벤치”: pre / infer / post(NMS) latency 리스트 수집

먼저 benchmarks.run()을 pt_only=True로 실행합니다.
이 benchmarks.run()은 내부에서 val.py를 **task='speed'**로 호출해서, COCO dataloader를 돌리면서 per-image latency를 리스트로 누적하도록 수정되어 있어요.
- val.py에서는 각 배치 반복마다 Profile() 타이머(dt[0], dt[1], dt[2])로:
    - dt[0]: preprocess(im/targets 이동, normalize 등)
    - dt[1]: model forward(inference)
    - dt[2]: non_max_suppression(NMS)
- 시간을 재고, 이를 “이미지 1장당 ms” 로 나눠서 리스트에 저장합니다. 

즉 여기서 얻는 건:
- lat_pre (ms/image)
- lat_infer (ms/image)
- lat_post (ms/image) ← 실제로는 NMS 시간

그리고 nvidia_e2e_val.py는 이 3개를 더해서:
- e2e_ms_list = pre + infer + post
를 만듭니다. 

### (B) “정확도”: COCO mAP 계산 (pycocotools)

그 다음 val.py를 한 번 더 돌려서(task='val'), 이번엔 save_json=True로 COCO-format 예측 JSON을 만들고, pycocotools COCOeval로 mAP를 계산합니다.
- save_json=True면 runs/val/`<name>`/..._predictions.json을 저장하고
- COCO annotation(instances_val2017.json)과 함께 COCOeval을 수행한 뒤 summarize를 찍습니다. 

여기서 최종적으로 mAP = results[3] (mAP50-95)를 꺼내고, 모델별 target(딕셔너리)과 비교해서 success/fail을 판정합니다. 

### 3) 출력 결과는 “무엇이 나오나?”

각 조합마다 (콘솔 + 로그)로 다음이 나옵니다.

#### 3-1. 한 줄 요약(RESULT 라인)

run_e2e()가 아래 형태로 1줄 요약을 먼저 print 합니다: 
- throughput (img/s)
    - e2e_wall_per_image: 현재는 e2e_active와 동일값(= 1000 / avg(e2e_ms))로 계산 
    - e2e_active: 1000 / avg(e2e_ms)
    - infer_only: 1000 / avg(infer_ms)
- latency avg(ms)
    - lat_pre_avg, lat_infer_avg, lat_post_avg
- accuracy
    - mAP, target, status
설정
- conf, iou
소요시간
- sec

#### 3-2. JSON summary 전체 출력

같은 내용을 구조화해서 JSON으로도 한 번 더 출력합니다. 포함 필드는: 
- model
- images (latency 샘플 개수)
- throughput_img_per_s : e2e_wall_per_image / e2e_active / infer_only
- latency_ms : pre/infer/post/e2e_active 각각 avg/p50/p90/p99(조건부)
- metrics : mAP, target, status, conf_thres, iou_thres, sec

#### 3-3. --simple에서 추가로 나오는 “마크다운 표”

--simple은 결과를 누적해서 아래 표를 만들어 출력/저장합니다. 
- 모델별 요약표: 한 모델에 대해 batch size별로 한 줄씩
- 모델별 전치(transposed) 표: metric이 row, batch가 column
- 배치별 요약표: batch size 고정하고 모델별로 한 줄씩
- 배치별 전치(transposed) 표: metric이 row, 모델이 column


# 결과물 관련  


## furiosa (warboy-vision-model)

### 저장되는 이미지?

```shell
python3 run_performance_suite.py --save-samples 10 --sample-start 1000
```

```shell
(venv) kcloud@k8s-worker2:~/yolov9/warboy-vision-models/warboy-vision-models$ tree -L 2 outputs
outputs
├── yolov9t
└── yolov9t_1
    ├── 000999_pred.jpg
    ├── 001000_pred.jpg
    ├── 001001_pred.jpg
    ├── 001002_pred.jpg
    ├── 001003_pred.jpg
    ├── 001004_pred.jpg
    ├── 001005_pred.jpg
    ├── 001006_pred.jpg
    ├── 001007_pred.jpg
    └── 001008_pred.jpg

2 directories, 10 files
```

### 10장만 추론하려면?

- Warboy 쪽은 min_items 같은 옵션이 딱 보이진 않고, 기본은 val2017 디렉토리의 “전량”을 읽습니다.
    - 파일 수 직접 줄이기: ../datasets/coco/val2017_10/ 같은 폴더를 만들고 이미지 10장만 복사한 뒤, config에서 image_dir을 그 폴더로 바꿔서 실행
    - 코드 수정 방법: test_warboy_yolo_performance_det()에서 images = images[:10]처럼 이미지 리스트를 자르는 방식


## nvidia (yolov9)

### 저장되는 이미지?

```shell
python3 nvidia_e2e_val.py --simple --save-samples 10 --sample-start 1000 --device 1
```

```shell
(venv) kcloud@k8s-worker2:~/yolov9/nvidia-yolo/yolov9$ tree -L 2 outputs/
outputs/
└── yolov9t_1
    ├── 000000119233_pred.jpg
    ├── 000000119365_pred.jpg
    ├── 000000119445_pred.jpg
    ├── 000000119452_pred.jpg
    ├── 000000119516_pred.jpg
    ├── 000000119641_pred.jpg
    ├── 000000119677_pred.jpg
    ├── 000000119828_pred.jpg
    ├── 000000119911_pred.jpg
    └── 000000119995_pred.jpg

1 directory, 10 files
```

### 10장만 추론하려면?

`--min-items` 파라미터 존재  
- nvidia_e2e_val.py는 현재 --min-items CLI 옵션을 직접 받진 않아서, “스크립트 유지”를 원하면 작은 패치가 필요
    - nvidia_e2e_val.py를 약간만 수정해서 bench_run(..., min_items=10) + val_run(..., min_items=10) 넘기거나
    - (이미 arg로도 있음) val.py를 직접 실행할 때 --min-items 10을 주면 됩니다.


## Viewer

### furiosa

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Warboy Outputs Viewer (+ latest performance_result metrics table)

What it does
- Serves boxed prediction images (e.g., *_pred.jpg) from outputs/<model>_<batch>/ as a 2-column grid
- Auto-detects available (model, batch) from ENF files in <enf-root> (e.g., yolov9t.enf, yolov9t_4b.enf)
- Picks outputs directory outputs/<model>_<batch> if it exists
- Parses latest logs/performance_result_*.log and shows a horizontal summary table under the model_batch selector
  - Converts latencies from ms -> s/img for clarity

Usage examples
  # from warboy-vision-models/warboy-vision-models:
  python viewer.py --host 0.0.0.0 --port 9999 \
    --enf-root ../models/enf/object_detection \
    --outputs-root outputs \
    --logs-root logs

  # force a specific model/batch:
  python viewer.py --model yolov9t --batch 1 --host 0.0.0.0 --port 9999 \
    --enf-root ../models/enf/object_detection --outputs-root outputs --logs-root logs
"""

from __future__ import annotations

import argparse
import html
import mimetypes
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, quote, unquote


# ENF naming: foo.enf (batch=1), foo_4b.enf (batch=4)
ENF_RE = re.compile(r"^(?P<model>.+?)(?:_(?P<batch>\d+)b)?\.enf$")

# performance_result_YYYYMMDD_HHMMSS.log
RESULT_LOG_RE = re.compile(r"^performance_result_(\d{8}_\d{6})\.log$")


def parse_enf_name(enf_path: Path) -> tuple[str, int] | None:
    m = ENF_RE.match(enf_path.name)
    if not m:
        return None
    model = m.group("model")
    batch_s = m.group("batch")
    batch = int(batch_s) if batch_s else 1
    return model, batch


def list_variants(enf_root: Path, outputs_root: Path) -> list[dict]:
    """
    Returns list of variants that exist in outputs:
      [{model, batch, enf, outdir, mtime}, ...]
    Sorted by outdir mtime desc (latest first).
    """
    variants: list[dict] = []
    if not enf_root.exists():
        return variants

    for enf in sorted(enf_root.glob("*.enf")):
        parsed = parse_enf_name(enf)
        if not parsed:
            continue
        model, batch = parsed
        outdir = outputs_root / f"{model}_{batch}"
        if not outdir.exists() or not outdir.is_dir():
            continue
        mtime = outdir.stat().st_mtime
        variants.append(
            {
                "model": model,
                "batch": batch,
                "enf": enf,
                "outdir": outdir,
                "mtime": mtime,
            }
        )

    variants.sort(key=lambda x: x["mtime"], reverse=True)
    return variants


def pick_variant(variants: list[dict], model: str | None, batch: int | None) -> dict | None:
    if not variants:
        return None
    if model is None and batch is None:
        return variants[0]
    for v in variants:
        if model is not None and v["model"] != model:
            continue
        if batch is not None and v["batch"] != batch:
            continue
        return v
    return None


def list_images(outdir: Path) -> list[Path]:
    exts = (".jpg", ".jpeg", ".png", ".webp")
    imgs = [p for p in outdir.iterdir() if p.is_file() and p.suffix.lower() in exts]
    # prefer *_pred.jpg first, then by name
    imgs.sort(key=lambda p: (0 if p.name.endswith("_pred.jpg") else 1, p.name))
    return imgs


def newest_result_log(logs_root: Path) -> Path | None:
    if not logs_root.exists():
        return None
    candidates = []
    for p in logs_root.iterdir():
        if not p.is_file():
            continue
        if RESULT_LOG_RE.match(p.name):
            candidates.append(p)
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def parse_result_log_for(model: str, batch: int, log_path: Path) -> dict | None:
    """
    Parse the summary row for given model/batch from performance_result_*.log.

    Expected row format:
    | 1 | 55.296 | 88.930 | 1.793 | 11.245 | 5.047 | 0.346 | 0.345 | success | 83.300 |
    """
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()

    row_re = re.compile(
        r"^\|\s*(\d+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([A-Za-z_]+)\s*\|\s*([0-9.]+)\s*\|$"
    )

    model_hdr = f"[model : {model}]"
    in_model_block = False

    for line in lines:
        s = line.strip()
        if s.startswith("[model :"):
            in_model_block = s.startswith(model_hdr)
            continue
        if not in_model_block:
            continue

        m = row_re.match(s)
        if not m:
            continue

        b = int(m.group(1))
        if b != batch:
            continue

        e2e_active = float(m.group(2))
        infer_only = float(m.group(3))
        lat_pre_ms = float(m.group(4))
        lat_infer_ms = float(m.group(5))
        lat_post_ms = float(m.group(6))
        map_ = float(m.group(7))
        target = float(m.group(8))
        status = m.group(9)
        sec = float(m.group(10))

        return {
            "batch_size": b,
            "e2e_active_img_s": e2e_active,
            "infer_only_img_s": infer_only,
            "lat_pre_ms": lat_pre_ms,
            "lat_infer_ms": lat_infer_ms,
            "lat_post_ms": lat_post_ms,
            "lat_pre_s_img": lat_pre_ms / 1000.0,
            "lat_infer_s_img": lat_infer_ms / 1000.0,
            "lat_post_s_img": lat_post_ms / 1000.0,
            "mAP": map_,
            "Target": target,
            "Status": status,
            "sec_s": sec,
            "log_path": str(log_path),
        }

    return None


def html_page(title: str, variants: list[dict], current: dict | None, images: list[Path], summary: dict | None) -> str:
    # dropdown options
    options = []
    for v in variants:
        label = f"{v['model']}_{v['batch']}"
        selected = ""
        if current and v["model"] == current["model"] and v["batch"] == current["batch"]:
            selected = " selected"
        options.append(f'<option value="{html.escape(label)}"{selected}>{html.escape(label)}</option>')

    # summary table
    summary_html = ""
    if current:
        if summary:
            summary_html = f"""
            <div class="metrics-wrap">
              <div class="meta" style="margin: 0 0 8px 0;">
                metrics from: {html.escape(summary["log_path"])}
              </div>
              <div style="overflow-x:auto;">
                <table class="metrics">
                  <thead>
                    <tr>
                      <th>model_batch</th>
                      <th>e2e_active (img/s)</th>
                      <th>infer_only (img/s)</th>
                      <th>pre (s/img)</th>
                      <th>infer (s/img)</th>
                      <th>post (s/img)</th>
                      <th>mAP</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>sec (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{html.escape(current["model"])}_{current["batch"]}</td>
                      <td>{summary["e2e_active_img_s"]:.3f}</td>
                      <td>{summary["infer_only_img_s"]:.3f}</td>
                      <td>{summary["lat_pre_s_img"]:.6f}</td>
                      <td>{summary["lat_infer_s_img"]:.6f}</td>
                      <td>{summary["lat_post_s_img"]:.6f}</td>
                      <td>{summary["mAP"]:.3f}</td>
                      <td>{summary["Target"]:.3f}</td>
                      <td>{html.escape(summary["Status"])}</td>
                      <td>{summary["sec_s"]:.3f}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            """
        else:
            summary_html = """
            <div class="metrics-wrap">
              <div class="empty">
                성능 로그(performance_result_*.log)에서 해당 model/batch 행을 찾지 못했습니다.
                (logs-root 경로, model명, batch, 로그 형식 확인)
              </div>
            </div>
            """

    # image cards
    cards = []
    for img in images:
        url = "/img/" + quote(img.name)
        cards.append(
            f"""
            <div class="card">
              <a href="{url}" target="_blank" rel="noopener">
                <img src="{url}" loading="lazy" />
              </a>
              <div class="cap">{html.escape(img.name)}</div>
            </div>
            """
        )

    current_label = f"{current['model']}_{current['batch']}" if current else "(none)"
    outdir_txt = str(current["outdir"]) if current else "(none)"

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <style>
    body {{
      margin: 0; padding: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      background: #0b0f17; color: #e8eefc;
    }}
    header {{
      position: sticky; top: 0;
      background: rgba(11,15,23,0.92);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(232,238,252,0.12);
      padding: 12px 14px;
      z-index: 10;
    }}
    .row {{
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    }}
    .title {{
      font-weight: 700; font-size: 16px;
    }}
    .meta {{
      opacity: 0.85; font-size: 12px;
    }}
    select, button {{
      background: #121a2a; color: #e8eefc;
      border: 1px solid rgba(232,238,252,0.18);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 14px;
    }}
    button:hover {{
      cursor: pointer;
      border-color: rgba(232,238,252,0.35);
    }}
    main {{
      padding: 14px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr)); /* 2 columns */
      gap: 12px;
    }}
    .card {{
      background: #0f1627;
      border: 1px solid rgba(232,238,252,0.12);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    }}
    .card img {{
      width: 100%;
      height: auto;
      display: block;
      background: #0b0f17;
    }}
    .cap {{
      padding: 8px 10px;
      font-size: 12px;
      opacity: 0.9;
      word-break: break-all;
      border-top: 1px solid rgba(232,238,252,0.08);
    }}
    .empty {{
      padding: 16px;
      border: 1px dashed rgba(232,238,252,0.25);
      border-radius: 14px;
      opacity: 0.9;
      background: rgba(15,22,39,0.6);
    }}

    .metrics-wrap {{
      margin-top: 12px;
    }}
    table.metrics {{
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: #0f1627;
      border: 1px solid rgba(232,238,252,0.12);
      border-radius: 14px;
      overflow: hidden;
      font-size: 13px;
    }}
    table.metrics th {{
      text-align: left;
      font-size: 12px;
      opacity: 0.95;
      padding: 10px;
      border-bottom: 1px solid rgba(232,238,252,0.08);
      white-space: nowrap;
    }}
    table.metrics td {{
      padding: 10px;
      border-bottom: 1px solid rgba(232,238,252,0.06);
      white-space: nowrap;
    }}
    table.metrics tbody tr:last-child td {{
      border-bottom: none;
    }}

    @media (max-width: 720px) {{
      .grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <header>
    <div class="row">
      <div class="title">Warboy Outputs Viewer</div>
      <div class="meta">Current: <b>{html.escape(current_label)}</b> · Dir: {html.escape(outdir_txt)}</div>
    </div>
    <div class="row" style="margin-top:10px;">
      <label class="meta">model_batch:</label>
      <select id="variant">
        {''.join(options)}
      </select>
      <button onclick="applyVariant()">Apply</button>
      <button onclick="location.reload()">Refresh</button>
      <div class="meta">Images: {len(images)}</div>
    </div>

    {summary_html}
  </header>

  <main>
    {"<div class='empty'>표시할 이미지가 없습니다. Warboy 실행 후 outputs/&lt;model&gt;_&lt;batch&gt;/에 *_pred.jpg가 생성됐는지 확인하세요.</div>" if len(images)==0 else f"<div class='grid'>{''.join(cards)}</div>"}
  </main>

  <script>
    function applyVariant() {{
      const v = document.getElementById('variant').value;
      // v format: model_batch (model may contain underscores)
      const parts = v.split('_');
      const batch = parts.pop();
      const model = parts.join('_');
      const url = new URL(window.location.href);
      url.searchParams.set('model', model);
      url.searchParams.set('batch', batch);
      window.location.href = url.toString();
    }}
  </script>
</body>
</html>
"""


class ViewerHandler(BaseHTTPRequestHandler):
    server_version = "WarboyViewer/1.1"

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        app = self.server.app  # type: ignore

        if path == "/" or path == "/index.html":
            model = qs.get("model", [None])[0]
            batch_s = qs.get("batch", [None])[0]
            batch = int(batch_s) if batch_s and batch_s.isdigit() else None

            variants = app["variants_fn"]()
            current = pick_variant(variants, model, batch)
            images = list_images(current["outdir"]) if current else []

            summary = None
            if current:
                log_path = newest_result_log(app["logs_root"])
                if log_path:
                    summary = parse_result_log_for(current["model"], current["batch"], log_path)

            body = html_page("Warboy Outputs Viewer", variants, current, images, summary).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # serve image file: /img/<filename>
        if path.startswith("/img/"):
            filename = unquote(path[len("/img/"):])

            variants = app["variants_fn"]()
            model = qs.get("model", [None])[0]
            batch_s = qs.get("batch", [None])[0]
            batch = int(batch_s) if batch_s and batch_s.isdigit() else None
            current = pick_variant(variants, model, batch)
            if not current:
                self.send_error(404, "No outputs directory found")
                return

            file_path = (current["outdir"] / filename).resolve()
            # prevent path traversal
            if current["outdir"].resolve() not in file_path.parents:
                self.send_error(403, "Forbidden")
                return
            if not file_path.exists() or not file_path.is_file():
                self.send_error(404, "File not found")
                return

            ctype, _ = mimetypes.guess_type(str(file_path))
            ctype = ctype or "application/octet-stream"
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404, "Not found")

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    ap.add_argument("--port", type=int, default=9999, help="Port (default: 9999)")
    ap.add_argument("--enf-root", default="../models/enf/object_detection", help="ENF directory")
    ap.add_argument("--outputs-root", default="outputs", help="Outputs root directory")
    ap.add_argument("--model", default=None, help="Force model name (optional)")
    ap.add_argument("--batch", type=int, default=None, help="Force batch size (optional)")
    ap.add_argument("--logs-root", default="logs", help="Logs directory (performance_result_*.log)")
    args = ap.parse_args()
    
    enf_root = Path(args.enf_root)
    outputs_root = Path(args.outputs_root)
    logs_root = Path(args.logs_root)

    def variants_fn():
        return list_variants(enf_root, outputs_root)

    variants = variants_fn()
    cur = pick_variant(variants, args.model, args.batch)
    if not cur:
        print(f"[WARN] No outputs found.")
        print(f"       ENF root: {enf_root}")
        print(f"       Outputs root: {outputs_root}")
        print("       Run Warboy first so outputs/<model>_<batch>/ has images, then refresh.")
    else:
        print(f"[INFO] Selected: {cur['model']}_{cur['batch']}  dir={cur['outdir']}")

    if newest_result_log(logs_root):
        print(f"[INFO] Logs root OK: {logs_root}")
    else:
        print(f"[WARN] No performance_result_*.log found under logs root: {logs_root}")

    httpd = ThreadingHTTPServer((args.host, args.port), ViewerHandler)
    httpd.app = {  # type: ignore
        "variants_fn": variants_fn,
        "logs_root": logs_root,
    }
    print(f"[INFO] Serving on http://{args.host}:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

```

### nvidia

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
NVIDIA YOLOv9 Outputs Viewer (PT-based)

What it does
- Discovers models from weights_root/*.pt (model name = pt stem)
- Discovers batch variants by scanning outputs_root/<model>_<batch>/ directories
- Serves boxed prediction images (e.g., *_pred.jpg) from outputs/<model>_<batch>/ as a 2-column grid
- Optional: shows latest nvidia_result_*.log metrics table (best-effort parser)
  - Converts latencies ms -> s/img

Typical layout (example)
  yolov9/
    weights/
      yolov9t.pt
      yolov9s.pt
  outputs/
    yolov9t_1/
      0000001000_pred.jpg
      ...
  logs/
    nvidia_result_20260116_....log

Usage
  python nvidia_viewer.py --host 0.0.0.0 --port 9999 \
    --weights-root yolov9/weights \
    --outputs-root outputs \
    --logs-root logs

  # force a specific model/batch:
  python nvidia_viewer.py --model yolov9t --batch 1 ...

Notes
- This viewer does NOT run inference. It only serves existing images under outputs_root.
- For multi-user access, prefer Service/NodePort/Ingress. For quick access use kubectl port-forward --address 0.0.0.0.
"""

from __future__ import annotations

import argparse
import html
import mimetypes
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, quote, unquote


PT_RE = re.compile(r"^(?P<model>.+)\.pt$")
OUTDIR_RE = re.compile(r"^(?P<model>.+)_(?P<batch>\d+)$")
NVIDIA_LOG_RE = re.compile(r"^nvidia_result_(\d{8}_\d{6})\.log$")


def parse_pt_name(pt_path: Path) -> str | None:
    m = PT_RE.match(pt_path.name)
    if not m:
        return None
    return m.group("model")


def parse_outdir_name(p: Path) -> tuple[str, int] | None:
    m = OUTDIR_RE.match(p.name)
    if not m:
        return None
    return m.group("model"), int(m.group("batch"))


def list_variants_from_pt(weights_root: Path, outputs_root: Path) -> list[dict]:
    """
    weights/*.pt 의 stem을 model로 쓰고,
    outputs/<model>_<batch>/ 가 존재하는 조합만 variants로 만든다.
    """
    variants: list[dict] = []
    if not weights_root.exists() or not outputs_root.exists():
        return variants

    models = set()
    for pt in weights_root.glob("*.pt"):
        model = parse_pt_name(pt)
        if model:
            models.add(model)

    for d in outputs_root.iterdir():
        if not d.is_dir():
            continue
        parsed = parse_outdir_name(d)
        if not parsed:
            continue
        model, batch = parsed
        if model not in models:
            continue

        variants.append(
            {
                "model": model,
                "batch": batch,
                "pt": weights_root / f"{model}.pt",
                "outdir": d,
                "mtime": d.stat().st_mtime,
            }
        )

    # latest outputs first
    variants.sort(key=lambda x: x["mtime"], reverse=True)
    return variants


def pick_variant(variants: list[dict], model: str | None, batch: int | None) -> dict | None:
    if not variants:
        return None
    if model is None and batch is None:
        return variants[0]
    for v in variants:
        if model is not None and v["model"] != model:
            continue
        if batch is not None and v["batch"] != batch:
            continue
        return v
    return None


def list_images(outdir: Path) -> list[Path]:
    exts = (".jpg", ".jpeg", ".png", ".webp")
    imgs = [p for p in outdir.iterdir() if p.is_file() and p.suffix.lower() in exts]
    # prefer *_pred.jpg first, then by name
    imgs.sort(key=lambda p: (0 if p.name.endswith("_pred.jpg") else 1, p.name))
    return imgs


def newest_nvidia_log(logs_root: Path) -> Path | None:
    if not logs_root.exists():
        return None
    candidates = []
    for p in logs_root.iterdir():
        if p.is_file() and NVIDIA_LOG_RE.match(p.name):
            candidates.append(p)
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def parse_nvidia_result_log_for(model: str, batch: int, log_path: Path) -> dict | None:
    """
    Best-effort parser for nvidia_result_*.log.

    It tries to find a markdown row like:
      | yolov9t | 55.373 | 85.593 | 1.422 | 11.683 | 4.954 | 0.349 | 0.345 | success | 85.620 |

    inside a section like:
      [batch_size : 1] ...
      | model | e2e_active ... |
      |-------| ... |
      | yolov9t | ...

    If your log format differs, adjust the regex below.
    """
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()

    # Enter batch block first (safer when multiple batches exist)
    batch_hdr_re = re.compile(r"^\[batch_size\s*:\s*(\d+)\]")
    in_batch_block = False

    row_re = re.compile(
        r"^\|\s*([^\|]+?)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([A-Za-z_]+)\s*\|\s*([0-9.]+)\s*\|$"
    )

    for line in lines:
        s = line.strip()

        m_hdr = batch_hdr_re.match(s)
        if m_hdr:
            in_batch_block = int(m_hdr.group(1)) == batch
            continue

        if not in_batch_block:
            continue

        m = row_re.match(s)
        if not m:
            continue

        row_model = m.group(1).strip()
        if row_model != model:
            continue

        e2e_active = float(m.group(2))
        infer_only = float(m.group(3))
        lat_pre_ms = float(m.group(4))
        lat_infer_ms = float(m.group(5))
        lat_post_ms = float(m.group(6))
        map_ = float(m.group(7))
        target = float(m.group(8))
        status = m.group(9)
        sec = float(m.group(10))

        return {
            "batch_size": batch,
            "e2e_active_img_s": e2e_active,
            "infer_only_img_s": infer_only,
            "lat_pre_ms": lat_pre_ms,
            "lat_infer_ms": lat_infer_ms,
            "lat_post_ms": lat_post_ms,
            "lat_pre_s_img": lat_pre_ms / 1000.0,
            "lat_infer_s_img": lat_infer_ms / 1000.0,
            "lat_post_s_img": lat_post_ms / 1000.0,
            "mAP": map_,
            "Target": target,
            "Status": status,
            "sec_s": sec,
            "log_path": str(log_path),
        }

    return None


def html_page(title: str, variants: list[dict], current: dict | None, images: list[Path], summary: dict | None) -> str:
    options = []
    for v in variants:
        label = f"{v['model']}_{v['batch']}"
        selected = ""
        if current and v["model"] == current["model"] and v["batch"] == current["batch"]:
            selected = " selected"
        options.append(f'<option value="{html.escape(label)}"{selected}>{html.escape(label)}</option>')

    summary_html = ""
    if current:
        if summary:
            summary_html = f"""
            <div class="metrics-wrap">
              <div class="meta" style="margin: 0 0 8px 0;">
                metrics from: {html.escape(summary["log_path"])}
              </div>
              <div style="overflow-x:auto;">
                <table class="metrics">
                  <thead>
                    <tr>
                      <th>model_batch</th>
                      <th>e2e_active (img/s)</th>
                      <th>infer_only (img/s)</th>
                      <th>pre (s/img)</th>
                      <th>infer (s/img)</th>
                      <th>post (s/img)</th>
                      <th>mAP</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>sec (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{html.escape(current["model"])}_{current["batch"]}</td>
                      <td>{summary["e2e_active_img_s"]:.3f}</td>
                      <td>{summary["infer_only_img_s"]:.3f}</td>
                      <td>{summary["lat_pre_s_img"]:.6f}</td>
                      <td>{summary["lat_infer_s_img"]:.6f}</td>
                      <td>{summary["lat_post_s_img"]:.6f}</td>
                      <td>{summary["mAP"]:.3f}</td>
                      <td>{summary["Target"]:.3f}</td>
                      <td>{html.escape(summary["Status"])}</td>
                      <td>{summary["sec_s"]:.3f}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            """
        else:
            summary_html = """
            <div class="metrics-wrap">
              <div class="empty">
                최신 nvidia_result_*.log에서 해당 model/batch 행을 찾지 못했습니다.
                (logs-root 경로, log format 확인)
              </div>
            </div>
            """

    cards = []
    for img in images:
        url = "/img/" + quote(img.name)
        cards.append(
            f"""
            <div class="card">
              <a href="{url}" target="_blank" rel="noopener">
                <img src="{url}" loading="lazy" />
              </a>
              <div class="cap">{html.escape(img.name)}</div>
            </div>
            """
        )

    current_label = f"{current['model']}_{current['batch']}" if current else "(none)"
    outdir_txt = str(current["outdir"]) if current else "(none)"

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(title)}</title>
  <style>
    body {{
      margin: 0; padding: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      background: #0b0f17; color: #e8eefc;
    }}
    header {{
      position: sticky; top: 0;
      background: rgba(11,15,23,0.92);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(232,238,252,0.12);
      padding: 12px 14px;
      z-index: 10;
    }}
    .row {{
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    }}
    .title {{
      font-weight: 700; font-size: 16px;
    }}
    .meta {{
      opacity: 0.85; font-size: 12px;
    }}
    select, button {{
      background: #121a2a; color: #e8eefc;
      border: 1px solid rgba(232,238,252,0.18);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 14px;
    }}
    button:hover {{
      cursor: pointer;
      border-color: rgba(232,238,252,0.35);
    }}
    main {{
      padding: 14px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }}
    .card {{
      background: #0f1627;
      border: 1px solid rgba(232,238,252,0.12);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    }}
    .card img {{
      width: 100%;
      height: auto;
      display: block;
      background: #0b0f17;
    }}
    .cap {{
      padding: 8px 10px;
      font-size: 12px;
      opacity: 0.9;
      word-break: break-all;
      border-top: 1px solid rgba(232,238,252,0.08);
    }}
    .empty {{
      padding: 16px;
      border: 1px dashed rgba(232,238,252,0.25);
      border-radius: 14px;
      opacity: 0.9;
      background: rgba(15,22,39,0.6);
    }}
    .metrics-wrap {{
      margin-top: 12px;
    }}
    table.metrics {{
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: #0f1627;
      border: 1px solid rgba(232,238,252,0.12);
      border-radius: 14px;
      overflow: hidden;
      font-size: 13px;
    }}
    table.metrics th {{
      text-align: left;
      font-size: 12px;
      opacity: 0.95;
      padding: 10px;
      border-bottom: 1px solid rgba(232,238,252,0.08);
      white-space: nowrap;
    }}
    table.metrics td {{
      padding: 10px;
      border-bottom: 1px solid rgba(232,238,252,0.06);
      white-space: nowrap;
    }}
    table.metrics tbody tr:last-child td {{
      border-bottom: none;
    }}
    @media (max-width: 720px) {{
      .grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <header>
    <div class="row">
      <div class="title">NVIDIA YOLOv9 Outputs Viewer</div>
      <div class="meta">Current: <b>{html.escape(current_label)}</b> · Dir: {html.escape(outdir_txt)}</div>
    </div>
    <div class="row" style="margin-top:10px;">
      <label class="meta">model_batch:</label>
      <select id="variant">
        {''.join(options)}
      </select>
      <button onclick="applyVariant()">Apply</button>
      <button onclick="location.reload()">Refresh</button>
      <div class="meta">Images: {len(images)}</div>
    </div>
    {summary_html}
  </header>

  <main>
    {"<div class='empty'>표시할 이미지가 없습니다. outputs/&lt;model&gt;_&lt;batch&gt;/에 이미지가 생성됐는지 확인하세요.</div>" if len(images)==0 else f"<div class='grid'>{''.join(cards)}</div>"}
  </main>

  <script>
    function applyVariant() {{
      const v = document.getElementById('variant').value;
      const parts = v.split('_');
      const batch = parts.pop();
      const model = parts.join('_');
      const url = new URL(window.location.href);
      url.searchParams.set('model', model);
      url.searchParams.set('batch', batch);
      window.location.href = url.toString();
    }}
  </script>
</body>
</html>
"""


class ViewerHandler(BaseHTTPRequestHandler):
    server_version = "NvidiaYoloViewer/1.0"

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        app = self.server.app  # type: ignore

        if path == "/" or path == "/index.html":
            model = qs.get("model", [None])[0]
            batch_s = qs.get("batch", [None])[0]
            batch = int(batch_s) if batch_s and batch_s.isdigit() else None

            variants = app["variants_fn"]()
            current = pick_variant(variants, model, batch)
            images = list_images(current["outdir"]) if current else []

            summary = None
            if current:
                log_path = newest_nvidia_log(app["logs_root"])
                if log_path:
                    summary = parse_nvidia_result_log_for(current["model"], current["batch"], log_path)

            body = html_page("NVIDIA YOLOv9 Outputs Viewer", variants, current, images, summary).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path.startswith("/img/"):
            filename = unquote(path[len("/img/"):])

            variants = app["variants_fn"]()
            model = qs.get("model", [None])[0]
            batch_s = qs.get("batch", [None])[0]
            batch = int(batch_s) if batch_s and batch_s.isdigit() else None
            current = pick_variant(variants, model, batch)
            if not current:
                self.send_error(404, "No outputs directory found")
                return

            file_path = (current["outdir"] / filename).resolve()
            if current["outdir"].resolve() not in file_path.parents:
                self.send_error(403, "Forbidden")
                return
            if not file_path.exists() or not file_path.is_file():
                self.send_error(404, "File not found")
                return

            ctype, _ = mimetypes.guess_type(str(file_path))
            ctype = ctype or "application/octet-stream"
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404, "Not found")

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    ap.add_argument("--port", type=int, default=9999, help="Port (default: 9999)")
    ap.add_argument("--weights-root", default="weights", help="Weights directory (*.pt)")
    ap.add_argument("--outputs-root", default="outputs", help="Outputs root directory")
    ap.add_argument("--logs-root", default="logs", help="Logs directory (nvidia_result_*.log)")
    ap.add_argument("--model", default=None, help="Force model name (optional)")
    ap.add_argument("--batch", type=int, default=None, help="Force batch size (optional)")
    args = ap.parse_args()

    weights_root = Path(args.weights_root)
    outputs_root = Path(args.outputs_root)
    logs_root = Path(args.logs_root)

    def variants_fn():
        return list_variants_from_pt(weights_root, outputs_root)

    variants = variants_fn()
    cur = pick_variant(variants, args.model, args.batch)
    if not cur:
        print("[WARN] No variants found.")
        print(f"       weights_root: {weights_root}")
        print(f"       outputs_root: {outputs_root}")
        print("       Ensure outputs/<model>_<batch>/ exists and weights/*.pt exists.")
    else:
        print(f"[INFO] Selected: {cur['model']}_{cur['batch']}  dir={cur['outdir']}")

    if newest_nvidia_log(logs_root):
        print(f"[INFO] Logs root OK: {logs_root}")
    else:
        print(f"[WARN] No nvidia_result_*.log found under logs root: {logs_root}")

    httpd = ThreadingHTTPServer((args.host, args.port), ViewerHandler)
    httpd.app = {  # type: ignore
        "variants_fn": variants_fn,
        "logs_root": logs_root,
    }
    print(f"[INFO] Serving on http://{args.host}:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
```

## 결과물 수치


| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 55.296 |
| infer_only (img/s) | 88.930 |
| lat_pre (ms) | 1.793 |
| lat_infer (ms) | 11.245 |
| lat_post (ms) | 5.047 |
| mAP | 0.346 |
| Target | 0.345 |
| Status | success |
| sec (s) | 83.300 |

### 1) infer_only (img/s) = 88.930 뜻

“Inference(모델 forward) 단계만” 놓고 보면 평균적으로 초당 약 88.93장을 처리할 수 있다는 뜻
- infer_only (img/s) = 1000 / lat_infer(ms) 로 계산돼.
- lat_infer = 11.245 ms면 1000 / 11.245 = 88.93 img/s → 표 값과 정확히 일치.

즉, “infer_only”는 전처리/후처리 제외하고, NPU/GPU의 순수 추론 처리량이라고 보면 됨.

### 2) lat_infer (ms) = 11.245 뜻 (12초 아님)

이건 **12초가 아니라 11.245 “밀리초(ms)”**
- 11.245 ms = 0.011245 초  

즉 이미지 1장 추론에 평균 0.011초 정도 걸린다는 뜻.

### 3) 그럼 5,000장 하면 얼마나 걸려?

(A) “추론만” 걸리는 시간 (infer_only 기준)

- 초당 88.93장 → 5000장 시간 = 5000 / 88.93
    - 계산하면:
        - 88.93 × 56 = 4,980.08
        - 남은 19.92 / 88.93 ≈ 0.224
        - → 약 56.224초
    - 또는 ms로: 11.245 ms × 5000 = 56,225 ms = 56.225초

✅ 결론: 추론만 보면 5,000장에 약 56.2초

(B) “전처리+추론+후처리” 합친 시간 (e2e_active 기준)

lat_pre + lat_infer + lat_post
= 1.793 + 11.245 + 5.047
= 18.085 ms/image

그러면 처리량:
- 1000 / 18.085 = 55.296 img/s (표와 일치)

5000장 시간:
- 18.085 ms × 5000 = 90,425 ms = 90.425초  

또는  

- 5000 / 55.296 ≈ 90.4초

✅ 결론: E2E(active)로 보면 5,000장에 약 90.4초

### 4) 근데 표의 sec (s)=83.300은 왜 90.4초보다 작지?

- sec(s)는 보통 “전체 실행 wall-time”이고, 
- e2e_active는 “pre/infer/post를 이미지별로 재서 합산한 평균 기반 추정”이라 측정 기준/겹침(파이프라인 병렬 처리) 때문에 차이가 날 수 있음
- 특히 Warboy 파이프라인은 preprocess / inference / postprocess가 프로세스로 분리돼서 겹쳐(파이프라이닝) 진행될 수 있어서, wall-time이 단순 합보다 줄어드는 경우가 있음


--- 

# Docker Image 화 (Pod 생성용)

## furiosa - Dockerfile

```shell
# syntax=docker/dockerfile:1.7
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

# 기본 + Python + 빌드툴 + OpenCV 런타임 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl apt-transport-https gnupg wget \
    python3 python3-pip python3-venv python-is-python3 \
    build-essential cmake libeigen3-dev \
    libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# Furiosa repo key + repo 등록
RUN mkdir -p /etc/apt/keyrings \
 && wget -q -O- https://archive.furiosa.ai/furiosa-apt-key.gpg \
    | gpg --dearmor \
    > /etc/apt/keyrings/furiosa-apt-key.gpg

RUN tee /etc/apt/sources.list.d/furiosa.list > /dev/null <<'EOT'
deb [arch=amd64 signed-by=/etc/apt/keyrings/furiosa-apt-key.gpg] https://archive.furiosa.ai/ubuntu jammy restricted
EOT

# Furiosa 패키지 설치 (auth는 secret로 주입, ro라 chmod 하지 않음)
RUN --mount=type=secret,id=furiosa_auth,dst=/etc/apt/auth.conf.d/furiosa.conf \
    apt-get update \
 && apt-get install -y --no-install-recommends \
      furiosa-libnux furiosa-toolkit furiosa-libhal-warboy furiosa-compiler \
 && command -v furiosactl \
 && rm -rf /var/lib/apt/lists/*

# venv 생성
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir -U pip setuptools wheel
ENV PATH="/opt/venv/bin:${PATH}"

# ====== 코드 bake-in ======
# (컨텍스트=warboy-vision-models 이므로 ./warboy-vision-models 가 실제 소스 루트)
WORKDIR /opt/warboy-vision-models
COPY warboy-vision-models/ /opt/warboy-vision-models/

# 실제 소스 루트는 /opt/warboy-vision-models/warboy-vision-models
ENV APP_DIR=/opt/warboy-vision-models/warboy-vision-models

# requirements bake-in
RUN test -f ${APP_DIR}/requirements.txt \
 && pip install --no-cache-dir -r ${APP_DIR}/requirements.txt

# C++ post-processing utilities 빌드
RUN test -f ${APP_DIR}/build.sh \
 && chmod +x ${APP_DIR}/build.sh \
 && ${APP_DIR}/build.sh

# warboy-vision CLI 생성(패키지 설치) + 최소 검증
RUN pip install --no-cache-dir ${APP_DIR} \
 && command -v warboy-vision \
 && python -c "import cv2; print('cv2 OK')"

CMD ["/bin/bash"]
```  

## furiosa - etc(key)  

- yolov9/dockerImage/furiosa.conf

```shell
machine archive.furiosa.ai
login 8fc07a1c-557f-482c-8960-923a4d31c109
password Ifa1rNN8ENQuafdpvABBZiEg9kzcl2OpaM5kSk1qctvm0X3jlhmBepIb7mmEAbIu
```  

## furiosa - .dockerignore

- yolov9/warboy-vision-models/.dockerignore

```shell
# 압축파일/아카이브 제외
**/*.tar.gz
**/*.tgz
**/*.zip

# Python 가상환경/캐시 제외
venv/
**/venv/
**/__pycache__/
**/*.pyc

# 로그/결과물 제외 (소스 안 logs/output/outputs가 있으면 굳이 bake-in 안함)
logs/
output/
outputs/
runs/

# 데이터셋/대용량 모델 제외
datasets/
models/bp/

# (선택) 기타
.git/
.diff
```  

## furiosa - create image

```shell
cd /home/kcloud/yolov9

sudo docker buildx build \
  -f dockerImage/furiosa/Dockerfile \
  --secret id=furiosa_auth,src=dockerImage/furiosa/furiosa.conf \
  -t 10.254.202.88:5100/furiosa-ai-sdk:1.0.6 \
  --push \
  .
```


## nvidia - Dockerfile

```shell
# syntax=docker/dockerfile:1.7
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

# OS deps: python + git + OpenCV runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python-is-python3 \
    ca-certificates curl git \
    libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# venv
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir -U pip setuptools wheel
ENV PATH="/opt/venv/bin:${PATH}"

# code bake-in
WORKDIR /opt/yolov9
COPY nvidia-yolo/yolov9/ /opt/yolov9/

# requirements bake-in (requirements.txt 사용)
RUN pip install --no-cache-dir -r /opt/yolov9/requirements.txt

WORKDIR /workspace
CMD ["/bin/bash"]


```
## nvidia - .dockerignore

```shell
# 대용량 데이터 제외(이미지에 굽지 않음)
datasets/
venv/

# 실행 결과/로그 제외
yolov9/runs/

# 파이썬 캐시
**/__pycache__/
**/*.pyc
**/*.pyo

# 압축파일
**/*.tar.gz
**/*.tgz
**/*.zip

# git
.git/
```

## nvidia - create image

```shell
cd /home/kcloud/yolov9

sudo docker buildx build \
  -f dockerImage/nvidia/Dockerfile \
  -t 10.254.202.88:5100/nvidia-yolov9:1.0.3 \
  --push \
  .
```

# Pod

> hostpath 경로는 실제 Pod가 배포되는 Worker Node에 동일한 경로가 존재해야 한다.


## furiosa

- /home/kcloud/yolov9/pods/npu-pod-yolov9

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: npu-pod-yolov9
spec:
  restartPolicy: Never
  containers:
  - name: npu-pod-yolov9
    image: 10.254.202.88:5100/furiosa-ai-sdk:1.0.6
    imagePullPolicy: Always
    command: ["/bin/bash", "-lc"]
    args:
      - |
        ln -sfn /opt/warboy-vision-models /workspace/warboy-vision-models
        ln -sfn /workspace/datasets /opt/datasets
        ln -sfn /workspace/models   /opt/models
        echo "[INFO] code=/opt/warboy-vision-models (also /workspace/warboy-vision-models via symlink)"
        echo "[INFO] datasets=/workspace/datasets -> /opt/datasets"
        echo "[INFO] models=/workspace/models -> /opt/models"
        sleep infinity
    env:
      - name: LD_LIBRARY_PATH
        value: /lib/x86_64-linux-gnu
    resources:
      limits:
        cpu: "32"
        memory: "8Gi"
        beta.furiosa.ai/npu: "1"
      requests:
        cpu: "32"
        memory: "8Gi"
        beta.furiosa.ai/npu: "1"
    volumeMounts:
      - name: datasets
        mountPath: /workspace/datasets
      - name: models
        mountPath: /workspace/models
  volumes:
    - name: datasets
      hostPath:
        path: /home/kcloud/yolov9/warboy-vision-models/datasets
        type: Directory
    - name: models
      hostPath:
        path: /home/kcloud/yolov9/warboy-vision-models/models
        type: Directory

```  

## nvidia

- /home/kcloud/yolov9/pods/gpu-pod-yolov9
    - 아래 `nvidia.com/gpu: "2"`는 k8s-worker1의 경우, A30, A2 두 개의 장치가 존재하기 때문  
    - 실행 시 , `--device 1` 옵션으로, `nvidia A2` 선택 가능하도록

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod-yolov9
spec:
  nodeName: k8s-worker1
  restartPolicy: Never
  containers:
  - name: gpu-pod-yolov9
    image: 10.254.202.88:5100/nvidia-yolov9:1.0.3
    imagePullPolicy: Always
    command: ["/bin/bash", "-lc"]
    args:
      - |
        set -e
        nvidia-smi || true
        ln -sfn /workspace/datasets /opt/datasets
        cd /opt/yolov9
        echo "  cd /opt/yolov9 && python nvidia_e2e_val.py --simple"
        sleep infinity
    resources:
      limits:
        cpu: "32"
        memory: "8Gi"
        nvidia.com/gpu: "2"
      requests:
        cpu: "32"
        memory: "8Gi"
        nvidia.com/gpu: "2"
    volumeMounts:
      - name: datasets
        mountPath: /workspace/datasets
      - name: dshm
        mountPath: /dev/shm
  volumes:
    - name: datasets
      hostPath:
        path: /home/kcloud/yolov9/nvidia-yolo/datasets
        type: Directory
    - name: dshm
      emptyDir:
        medium: Memory
        sizeLimit: "64Gi"

```

> resoure 중, cpu를 32 이하로 하면, infer_only 성능이 하락한다.

- Kubernetes에서 resources.limits.cpu=4면 컨테이너는 “4코어만큼의 시간”만 쓸 수 있음  
    - 이게 단순히 “코어 4개면 충분” 문제가 아니라:
        - PyTorch/Ultralytics 내부가 여러 스레드(OpenMP, MKL, dataloader, numpy, image decode/resize 등)를 쓰거나 짧은 작업들이 자주 생기는데(전처리/후처리/큐 관리/동기화) CFS quota에 걸리면 자주 멈췄다가 재개하면서 지연이 늘어남
        - 그 결과 GPU는 계산할 준비가 된 텐서가 늦게 오고, GPU가 대기하는 시간이 늘어나서 lat_infer로 “뭉쳐서” 측정될 수 있음

- infer_only 측정에 포함될 수 있는 부분  
    - CPU에서 텐서 준비/reshape/contiguous
    - H2D 복사/동기화 지점
    - torch/cuda 런타임 오버헤드
    - 비동기 커널 타이밍 측정 실수(동기화 없이 측정하면 구간이 왜곡됨)
    - dataloader/큐 대기로 인해 “GPU 시작 시점이 늦어졌는데” 그게 측정 구간에 포함

> 즉, Pod에서 CPU 4 제한이 PyTorch/Ultralytics 파이프라인 전체를 병목으로 만들어 GPU가 대기했고, 그 대기 시간이 infer_only/lat_infer에 섞여 들어가 “GPU가 느린 것처럼” 보임. CPU를 32로 풀어주니 파이프라인이 host처럼 공급돼서 GPU가 제 속도로 돌아옴  

- 확인 방법
    - Pod에서 CPU=4일 때 실행 중 nvidia-smi dmon 보면 GPU util이 들쭉날쭉/낮게 나오거나,
        - power/clock이 충분히 안 올라가는 순간이 많을 가능성 큼 (GPU가 할 일이 없어서)
    - CPU=4일 때 top -H 보면 python 프로세스 스레드들이 runnable 상태로 대기하거나
        - dataloader/전처리 스레드가 빡빡하게 도는 게 보일 수 있음
    - 아래 환경변수로 “CPU 스레드 과다 사용”을 줄이면 CPU=4에서도 나아질 수 있음

```shell
export OMP_NUM_THREADS=4
export MKL_NUM_THREADS=4
export NUMEXPR_NUM_THREADS=4
```  

> 만약 batch size를 1보다 크게 하여 테스트하고 싶으면, 아래 설정을 pod yaml에 추가시켜줘야 한다.  
> shm이 부족하면 OOM/Bus Error 발생하기 때문  

```yaml
volumes:
- name: dshm
  emptyDir:
    medium: Memory
    sizeLimit: "64Gi"
volumeMounts:
- name: dshm
  mountPath: /dev/shm
```

# 실행 및 확인

```shell
cd /home/kcloud/yolov9/pods
kubectl apply -f npu-pod-yolov9.yaml
kubectl apply -f gpu-pod-yolov9.yaml


kubectl get pods -o wide | awk '{print $1,$2,$3,$4,$6,$7}' | column -t
```


```shell
## --- furiosa
kubectl exec -it npu-pod-yolov9 -- bash -lc '
  cd /opt/warboy-vision-models/warboy-vision-models/ &&
  python run_performance_suite.py \
'

## --- nvidia
kubectl exec -it gpu-pod-yolov9 -- bash -lc '
  cd /opt/yolov9/ &&
  python nvidia_e2e_val.py --simple --device 1 \
'
```

```shell
## --- furiosa
kubectl exec -it npu-pod-yolov9 -- bash -lc '
  cd /opt/warboy-vision-models/warboy-vision-models &&
  python viewer.py --host 0.0.0.0 --port 9999 \
'

## --- nvidia
kubectl exec -it gpu-pod-yolov9 -- bash -lc '
  cd /opt/yolov9 &&
  python viewer.py --host 0.0.0.0 --port 9998 \
'
```

```shell
## --- etc (viwer 실행 시, 경로 지정 필요하다면)
    --enf-root /opt/models/enf/object_detection \
    --outputs-root /opt/warboy-vision-models/warboy-vision-models/outputs \
    --logs-root /opt/warboy-vision-models/warboy-vision-models/logs
```

```shell
## --- furiosa
kubectl port-forward pod/npu-pod-yolov9 --address 0.0.0.0 9999:9999

## --- nvidia
kubectl port-forward pod/gpu-pod-yolov9 --address 0.0.0.0 9998:9998
``` 


# Warboy 실행화면

```shell
(venv) kcloud@k8s-worker2:~/yolov9/warboy-vision-models/warboy-vision-models$ python3 run_performance_suite.py
[2026-02-05 15:00:08] ================================================================================
[2026-02-05 15:00:08] ===== Run started at 2026-02-05 15:00:08 =====
[2026-02-05 15:00:08] Full log file: /home/kcloud/yolov9/warboy-vision-models/warboy-vision-models/logs/performance_full_20260205_150008.log
[2026-02-05 15:00:08] Result log file: /home/kcloud/yolov9/warboy-vision-models/warboy-vision-models/logs/performance_result_20260205_150008.log
[2026-02-05 15:00:08] ================================================================================
[2026-02-05 15:00:08] [CLEANUP] Killed leftover 'warboy-vision model-performance' processes
[2026-02-05 15:00:13] Models to process: ['yolov9t']
[2026-02-05 15:00:13] ================================================================================
[2026-02-05 15:00:13] PROCESS MODEL: yolov9t
[2026-02-05 15:00:13] Available batches: [1]
[2026-02-05 15:00:13] RUN: warboy-vision model-performance --config_file /home/kcloud/yolov9/warboy-vision-models/warboy-vision-models/tutorials/cfg/yolov9t.yaml --batch-size 1
loading annotations into memory...
Done (t=0.62s)
creating index...
index created!
[Pipeline.add] Engine registered: {
  "model": "../models/enf/object_detection/yolov9t.enf",
  "worker_num": 16,
  "device": "warboy(1)*1",
  "batch_size": 1,
  "conf_thres": 0.025,
  "iou_thres": 0.6
}
0.025 0.6 [None] False
[WarboyApplication] Loading precompiled ENF: ../models/enf/object_detection/yolov9t.enf
WarboyApplication - init
2026-02-05T06:00:16.353103Z  INFO furiosa_rt_core::driver::event_driven::coord: FuriosaRT (v0.10.5, rev: 5537afb71-modified, built at: 2025-01-10T02:06:37Z) bootstrapping ...
2026-02-05T06:00:16.360713Z  INFO furiosa_rt_core::driver::event_driven::coord: Found furiosa-compiler (v0.10.1, rev: 8b00177, built at: 2025-01-08T02:00:45Z)
2026-02-05T06:00:16.360734Z  INFO furiosa_rt_core::driver::event_driven::coord: Found libhal (type: warboy, v0.12.0, rev: 56530c0 built at: 2023-11-16T12:37:25Z)
2026-02-05T06:00:16.360742Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] detected 1 NPU device(s):
2026-02-05T06:00:16.386949Z  INFO furiosa_rt_core::driver::event_driven::coord: - [0] npu:0:1 (warboy-b0, 64dpes, firmware: 1.7.7, 386a8ab)
2026-02-05T06:00:16.387172Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] started
2026-02-05T06:00:16.390039Z  INFO furiosa::runtime: Saving the compilation log into /home/kcloud/.local/state/furiosa/logs/compiler-20260205150016-sxs7am.log
2026-02-05T06:00:16.403496Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created Sess-5c20cc37 using npu:0:1
2026-02-05T06:00:16.427121Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-5c20cc37] compiling the model (target: warboy-b0, 64dpes, file: yolov9t.enf, size: 11.8 MiB)
2026-02-05T06:00:16.867326Z  INFO furiosa_rt_core::driver::event_driven::coord: [Sess-5c20cc37] the model compile is successful (took 0 secs)
2026-02-05T06:00:16.925536Z  INFO furiosa_rt_core::driver::event_driven::coord: [Runtime-0] created 16 NPU threads on npu:0:1 (DRAM: 42.7 MiB/16.0 GiB, SRAM: 9.6 MiB/64.0 MiB)
[Decoder] 0 pre=3.732 ms
[Decoder] 1 pre=0.883 ms
[Decoder] 2 pre=0.755 ms
[Decoder] 3 pre=7.336 ms
[Decoder] 4 pre=1.493 ms
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 0 infer=15.454 ms
[DEBUG bs=1] <class 'list'> None
  head0: <class 'numpy.ndarray'> (1, 64, 80, 80)
  head1: <class 'numpy.ndarray'> (1, 80, 80, 80)
  head2: <class 'numpy.ndarray'> (1, 64, 40, 40)
  head3: <class 'numpy.ndarray'> (1, 80, 40, 40)
  head4: <class 'numpy.ndarray'> (1, 64, 20, 20)
  head5: <class 'numpy.ndarray'> (1, 80, 20, 20)
[Runtime] 1 infer=18.538 ms
[Runtime] 2 infer=17.787 ms
[Runtime] 3 infer=14.087 ms
[Runtime] 4 infer=15.526 ms
[Encoder] 0 post=9.928 ms e2e_active=29.114 ms e2e_wall=NA
[Encoder] 1 post=4.320 ms e2e_active=23.741 ms e2e_wall=NA
[Encoder] 2 post=5.146 ms e2e_active=23.688 ms e2e_wall=NA
[Encoder] 3 post=4.568 ms e2e_active=25.990 ms e2e_wall=NA
[Encoder] 4 post=5.125 ms e2e_active=22.143 ms e2e_wall=NA
/home/kcloud/.local/lib/python3.10/site-packages/numpy/_core/getlimits.py:558: UserWarning: The value of the smallest subnormal for <class 'numpy.float32'> type is zero.
  setattr(self, word, getattr(machar, word).flat[0])
/home/kcloud/.local/lib/python3.10/site-packages/numpy/_core/getlimits.py:90: UserWarning: The value of the smallest subnormal for <class 'numpy.float32'> type is zero.
  return self._float_to_str(self.smallest_subnormal)
/home/kcloud/.local/lib/python3.10/site-packages/numpy/_core/getlimits.py:558: UserWarning: The value of the smallest subnormal for <class 'numpy.float64'> type is zero.
  setattr(self, word, getattr(machar, word).flat[0])
/home/kcloud/.local/lib/python3.10/site-packages/numpy/_core/getlimits.py:90: UserWarning: The value of the smallest subnormal for <class 'numpy.float64'> type is zero.
  return self._float_to_str(self.smallest_subnormal)
Inference Done in 84.66 sec
{
  "model": "yolov9t",
  "cfg": "yolov9t.yaml",
  "images": 5000,
  "throughput_img_per_s": {
    "e2e_active": 54.59298607636856,
    "infer_only": 86.22069979583928
  },
  "latency_ms": {
    "pre": {
      "avg": 1.7994987935759128,
      "p50": 1.7143795266747475
    },
    "infer": {
      "avg": 11.598142932821066,
      "p50": 11.360323522239923
    },
    "post": {
      "avg": 4.919729640707374,
      "p50": 4.877409664914012
    },
    "e2e_active": {
      "avg": 18.31737136710435,
      "p50": 18.09517852962017
    }
  }
}
Loading and preparing results...
DONE (t=0.36s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=16.44s).
Accumulating evaluation results...
DONE (t=2.60s).
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.346
 Average Precision  (AP) @[ IoU=0.50      | area=   all | maxDets=100 ] = 0.488
 Average Precision  (AP) @[ IoU=0.75      | area=   all | maxDets=100 ] = 0.368
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.155
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.388
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.493
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=  1 ] = 0.284
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets= 10 ] = 0.439
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.459
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.225
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.512
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.614
yolov9t Accuracy check success! -> mAP: 0.3461028797017871 [Target: 0.3447]

[2026-02-05 15:02:09] RESULT yolov9t bs=1 | e2e_active=54.59298607636856 infer_only=86.22069979583928 | lat_pre_avg=1.7994987935759128 lat_infer_avg=11.598142932821066 lat_post_avg=4.919729640707374 | mAP=0.3461028797017871 target=0.3447 status=success | conf=0.025 iou=0.6 sec=84.66

[2026-02-05 15:02:09]
[model : yolov9t] : conf (0.025), iou (0.600)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| 1 | 54.593 | 86.221 | 1.799 | 11.598 | 4.920 | 0.346 | 0.345 | success | 84.660 |

[2026-02-05 15:02:09]
[transposed summary: model=yolov9t, conf (0.025), iou (0.600)]

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 54.593 |
| infer_only (img/s) | 86.221 |
| lat_pre (ms) | 1.799 |
| lat_infer (ms) | 11.598 |
| lat_post (ms) | 4.920 |
| mAP | 0.346 |
| Target | 0.345 |
| Status | success |
| sec (s) | 84.660 |

[2026-02-05 15:02:09]
[batch_size : 1] : conf (0.025), iou (0.600)

| model | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|-------|--------------------|--------------------|----------------|-----------------|----------------|-----|--------|--------|---------|
| yolov9t | 54.593 | 86.221 | 1.799 | 11.598 | 4.920 | 0.346 | 0.345 | success | 84.660 |

[2026-02-05 15:02:09]
[transposed summary: batch_size=1, conf (0.025), iou (0.600)]

| models | yolov9t |
| --- | --- |
| e2e_active (img/s) | 54.593 |
| infer_only (img/s) | 86.221 |
| lat_pre (ms) | 1.799 |
| lat_infer (ms) | 11.598 |
| lat_post (ms) | 4.920 |
| mAP | 0.346 |
| Target | 0.345 |
| Status | success |
| sec (s) | 84.660 |

[2026-02-05 15:02:09] All done.

```


# Nvidia 실행화면

```shell
(venv) kcloud@k8s-worker1:~/yolov9/nvidia-yolo/yolov9$ python3 nvidia_e2e_val.py --simple
[2026-02-05 14:59:19] ================================================================================
[2026-02-05 14:59:19] ===== Simple Run started at 2026-02-05 14:59:19 =====
[2026-02-05 14:59:19] Full log file: /home/kcloud/yolov9/nvidia-yolo/yolov9/logs/nvidia_full_20260205_145919.log
[2026-02-05 14:59:19] Result log file: /home/kcloud/yolov9/nvidia-yolo/yolov9/logs/nvidia_result_20260205_145919.log
[2026-02-05 14:59:19] ================================================================================
[2026-02-05 14:59:19] dev_id: 0
[2026-02-05 14:59:19] ================================================================================
[2026-02-05 14:59:19] [device 0 : NVIDIA A30] [f32]
[2026-02-05 14:59:19] ================================================================================
[2026-02-05 14:59:19] PROCESS MODEL: yolov9t
[2026-02-05 14:59:19] o.device:  0
[2026-02-05 14:59:19] run_e2e - opt.device: 0
[2026-02-05 14:59:19] run_e2e - name: NVIDIA A30
YOLO 🚀 v0.1-112-g1eb03c3 Python-3.10.12 torch-2.8.0+cu128 CUDA:0 (NVIDIA A30, 24164MiB)

YOLO 🚀 v0.1-112-g1eb03c3 Python-3.10.12 torch-2.8.0+cu128 CUDA:0 (NVIDIA A30, 24164MiB)

YOLOv9t summary (fused): 197 layers, 2,094,000 parameters, 0 gradients, 8.2 GFLOPs
val: Scanning /home/kcloud/yolov9/nvidia-yolo/datasets/coco/val2017... 4952 images, 48 backgrounds, 0 corrupt: 100%|██████████| 5000/5000 00:00
val: New cache created: /home/kcloud/yolov9/nvidia-yolo/datasets/coco/val2017.cache
                 Class     Images  Instances          P          R      mAP50   mAP50-95: 100%|██████████| 5000/5000 01:42
                   all       5000      36335      0.634      0.477      0.522      0.377
Speed: 0.3ms pre-process, 12.5ms inference, 1.1ms NMS per image at shape (1, 3, 640, 640)
Results saved to runs/val/exp30


Checking setup...
YOLO 🚀 v0.1-112-g1eb03c3 Python-3.10.12 torch-2.8.0+cu128 CUDA:0 (NVIDIA A30, 24164MiB)
Setup complete ✅ (96 CPUs, 754.6 GB RAM, 181.7/435.0 GB disk)

Benchmarks complete (106.08s)
    Format  Size (MB)  mAP50-95  Inference time (ms)
0  PyTorch        4.7    0.3768                12.46
YOLO 🚀 v0.1-112-g1eb03c3 Python-3.10.12 torch-2.8.0+cu128 CUDA:0 (NVIDIA A30, 24164MiB)

YOLOv9t summary (fused): 197 layers, 2,094,000 parameters, 0 gradients, 8.2 GFLOPs
val: Scanning /home/kcloud/yolov9/nvidia-yolo/datasets/coco/val2017.cache... 4952 images, 48 backgrounds, 0 corrupt: 100%|██████████| 5000/5000 00:00
                 Class     Images  Instances          P          R      mAP50   mAP50-95: 100%|██████████| 5000/5000 01:48
                   all       5000      36335      0.634      0.477      0.534      0.394
Speed: 0.3ms pre-process, 12.6ms inference, 0.8ms NMS per image at shape (1, 3, 640, 640)

Evaluating pycocotools mAP... saving runs/val/yolov9t_110/yolov9t_predictions.json...
loading annotations into memory...
Done (t=0.62s)
creating index...
index created!
Loading and preparing results...
DONE (t=0.98s)
creating index...
index created!
Running per image evaluation...
Evaluate annotation type *bbox*
DONE (t=17.73s).
Accumulating evaluation results...
DONE (t=3.18s).
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.372
 Average Precision  (AP) @[ IoU=0.50      | area=   all | maxDets=100 ] = 0.515
 Average Precision  (AP) @[ IoU=0.75      | area=   all | maxDets=100 ] = 0.401
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.173
 Average Precision  (AP) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.409
 Average Precision  (AP) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.533
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=  1 ] = 0.312
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets= 10 ] = 0.493
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=   all | maxDets=100 ] = 0.520
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= small | maxDets=100 ] = 0.269
 Average Recall     (AR) @[ IoU=0.50:0.95 | area=medium | maxDets=100 ] = 0.576
 Average Recall     (AR) @[ IoU=0.50:0.95 | area= large | maxDets=100 ] = 0.709
Results saved to runs/val/yolov9t_110
RESULT yolov9t bs=1 | e2e_active=72.47111947520725 infer_only=80.2739297632971 | lat_pre_avg=0.28115010261535645 lat_infer_avg=12.45734453201294 lat_post_avg=1.0601055145263671 | mAP=0.37183177588259114 target=0.3447 status=success | conf=0.025 iou=0.7 sec=241.84
{
  "model": "yolov9t",
  "images": 5000,
  "throughput_img_per_s": {
    "e2e_active": 72.47111947520725,
    "infer_only": 80.2739297632971
  },
  "latency_ms": {
    "pre": {
      "avg": 0.28115010261535645,
      "p50": 0.28586387634277344,
      "p90": 0.3044605255126953,
      "p99": 0.3180503845214844
    },
    "infer": {
      "avg": 12.45734453201294,
      "p50": 12.059211730957031,
      "p90": 14.703512191772461,
      "p99": 14.973878860473633
    },
    "post": {
      "avg": 1.0601055145263671,
      "p50": 0.9567737579345703,
      "p90": 1.3582706451416016,
      "p99": 1.8668174743652344
    },
    "e2e_active": {
      "avg": 13.798600149154662,
      "p50": 13.370752334594727,
      "p90": 16.11042022705078,
      "p99": 16.86263084411621
    }
  },
  "metrics": {
    "mAP": 0.37183177588259114,
    "target": 0.3447,
    "status": "success",
    "conf_thres": 0.025,
    "iou_thres": 0.7,
    "sec": 241.83734703063965
  }
}
[2026-02-05 15:03:20] RESULT yolov9t bs=1 | mAP=0.37183177588259114 target=0.3447 status=success | conf=0.025 iou=0.7 sec=241.84
[2026-02-05 15:03:20]
[model : yolov9t] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| 1 | 72.471 | 80.274 | 0.281 | 12.457 | 1.060 | 0.372 | 0.345 | success | 241.837 |

[2026-02-05 15:03:20]
[transposed summary: model=yolov9t] : conf (0.025), iou (0.700)

| batch_size | 1 |
| --- | --- |
| e2e_active (img/s) | 72.471 |
| infer_only (img/s) | 80.274 |
| lat_pre (ms) | 0.281 |
| lat_infer (ms) | 12.457 |
| lat_post (ms) | 1.060 |
| mAP | 0.372 |
| Target | 0.345 |
| Status | success |
| sec (s) | 241.837 |

[2026-02-05 15:03:20]
[batch_size : 1] : conf (0.025), iou (0.700)

| batch_size | e2e_active (img/s) | infer_only (img/s) | lat_pre (ms) | lat_infer (ms) | lat_post (ms) | mAP | Target | Status | sec (s) |
|------------|--------------------|--------------------|--------------|----------------|---------------|-----|--------|--------|---------|
| yolov9t | 72.471 | 80.274 | 0.281 | 12.457 | 1.060 | 0.372 | 0.345 | success | 241.837 |

[2026-02-05 15:03:20]
[transposed summary: batch_size=1] : conf (0.025), iou (0.700)

| models | yolov9t |
| --- | --- |
| e2e_active (img/s) | 72.471 |
| infer_only (img/s) | 80.274 |
| lat_pre (ms) | 0.281 |
| lat_infer (ms) | 12.457 |
| lat_post (ms) | 1.060 |
| mAP | 0.372 |
| Target | 0.345 |
| Status | success |
| sec (s) | 241.837 |

[2026-02-05 15:03:20] All done.
```


