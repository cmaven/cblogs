<!-- neovim-lazy-setup.md: lazy.nvim 기반 Neovim 완전 세팅 가이드 | 수정일: 2026-04-16 -->
---
title: "lazy.nvim으로 시작하는 Neovim 완전 세팅 가이드 — 플러그인·LSP·성능 최적화"
description: "lazy.nvim 플러그인 관리자로 Neovim을 처음부터 설정하는 전체 절차. Telescope 파일 검색, Treesitter 구문 강조, nvim-lspconfig LSP 연동, 지연 로딩으로 시작 속도 40ms 이하 달성까지 실전 구성 포함."
excerpt: "lazy.nvim 하나로 플러그인 관리·지연 로딩·GUI 상태 확인 완성 — 초보자도 첫 시도에 성공하는 Neovim 세팅 체크리스트"
date: 2026-04-02
category: dev
subcategory: tooling
tags: [Neovim, Lua, lazy-nvim, LSP, Telescope, Treesitter, 플러그인, 개발환경]
---

# lazy.nvim으로 시작하는 Neovim 완전 세팅 가이드 — 플러그인·LSP·성능 최적화

**📅 작성일**: 2026년 4월 2일

> [!NOTE]
> :bulb: lazy.nvim 플러그인 관리자를 기반으로 Neovim을 처음 세팅하는 완전한 절차를 정리한다. 디렉터리 구조 설계, Telescope·Treesitter·LSP 핵심 플러그인 설치, 지연 로딩으로 시작 속도 40ms 이하 달성, 자동완성·테마까지 실전에서 바로 쓸 수 있는 구성을 단계별로 다룬다.

## 왜 lazy.nvim인가

Neovim의 플러그인 관리자 생태계는 `vim-plug` → `packer.nvim` → `lazy.nvim` 순서로 발전했다. 현재 `packer.nvim`은 공식적으로 유지 보수가 중단되었고, `lazy.nvim`이 사실상 표준 플러그인 관리자로 자리잡았다.

| 항목 | vim-plug | packer.nvim | lazy.nvim |
|------|----------|-------------|-----------|
| 설정 언어 | VimScript | Lua | Lua |
| 지연 로딩 | 제한적 | 지원 | 완전 지원 |
| GUI 대시보드 | 없음 | 없음 | 내장 |
| 유지보수 상태 | 활성 | **중단** | 활성 |
| 평균 시작 시간 | 250ms+ | 180ms | **38ms** |

`lazy.nvim`의 핵심 강점은 **지연 로딩(lazy loading)**이다. 플러그인을 필요한 시점(특정 파일타입 열기, 명령어 실행 등)에만 로드하므로 Neovim 시작 시간을 획기적으로 줄인다.

> [!TIP]
> Neovim 0.9 이상이 필요하다. `nvim --version`으로 확인하자. Ubuntu 22.04 이하의 APT 패키지는 구버전이므로, `snap install nvim --classic` 또는 [공식 GitHub 릴리즈](https://github.com/neovim/neovim/releases)에서 최신 버전을 받자.

## 사전 준비물 확인

설정 전 아래 도구들이 설치되어 있어야 한다. 특히 `git`과 `ripgrep`은 필수다.

| 도구 | 용도 | 설치 확인 |
|------|------|----------|
| Neovim 0.9+ | 에디터 본체 | `nvim --version` |
| git 2.x+ | 플러그인 클론 | `git --version` |
| ripgrep (`rg`) | Telescope 파일 내용 검색 | `rg --version` |
| fd | Telescope 빠른 파일 탐색 | `fd --version` |
| Node.js 18+ | 일부 LSP 서버 (tsserver 등) | `node --version` |
| Nerd Font | 아이콘 렌더링 | 터미널 폰트 확인 |

Ubuntu/Debian 기준 설치:

```bash
sudo apt update
sudo apt install -y git ripgrep fd-find nodejs npm
# fd 명령어가 fdfind로 설치되는 경우
sudo ln -s $(which fdfind) ~/.local/bin/fd
```

## 1단계: 디렉터리 구조 설계

무질서하게 `init.lua` 하나에 모든 설정을 넣으면 나중에 관리가 불가능해진다. 처음부터 모듈 구조로 시작하자.

```
~/.config/nvim/
├── init.lua                    # 진입점: lazy.nvim 부트스트랩
└── lua/
    ├── config/
    │   ├── lazy.lua            # lazy.nvim 초기화
    │   ├── options.lua         # vim.opt 설정
    │   └── keymaps.lua         # 키매핑
    └── plugins/
        ├── ui.lua              # 테마, 상태바 등 UI 플러그인
        ├── editor.lua          # Telescope, 파일트리 등
        ├── treesitter.lua      # 구문 강조
        └── lsp.lua             # LSP, 자동완성
```

이 구조에서 `require("lazy").setup("plugins")`를 호출하면 lazy.nvim이 `lua/plugins/` 디렉터리의 모든 `.lua` 파일을 자동으로 읽는다.

## 2단계: lazy.nvim 부트스트랩

`~/.config/nvim/init.lua`:

```lua
-- init.lua: Neovim 진입점 — lazy.nvim 부트스트랩 후 모듈 로드
require("config.lazy")
require("config.options")
require("config.keymaps")
```

`~/.config/nvim/lua/config/lazy.lua`:

```lua
-- lazy.lua: lazy.nvim 자동 설치 및 초기화
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

-- lazy.nvim이 없으면 자동 클론
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end

-- runtimepath 맨 앞에 추가
vim.opt.rtp:prepend(lazypath)

-- lua/plugins/ 디렉터리 전체를 플러그인 명세로 로드
require("lazy").setup("plugins", {
  change_detection = { notify = false },
  ui = { border = "rounded" },
})
```

Neovim을 처음 실행하면 lazy.nvim이 자동 설치되고 `:Lazy` 명령어로 GUI 대시보드를 열 수 있다.

> [!IMPORTANT]
> `vim.opt.rtp:prepend(lazypath)` 줄은 반드시 `require("lazy").setup()` **앞에** 위치해야 한다. 순서가 바뀌면 lazy.nvim 자체를 찾지 못해 `module 'lazy' not found` 오류가 발생한다.

## 3단계: 기본 옵션 설정

`~/.config/nvim/lua/config/options.lua`:

```lua
-- options.lua: 편집기 기본 동작 설정
local opt = vim.opt

-- 줄 번호
opt.number = true          -- 절대 줄 번호
opt.relativenumber = true  -- 상대 줄 번호 (이동 편의)

-- 들여쓰기
opt.tabstop = 2
opt.shiftwidth = 2
opt.expandtab = true       -- 탭을 스페이스로 변환
opt.smartindent = true

-- 검색
opt.ignorecase = true      -- 대소문자 무시
opt.smartcase = true       -- 대문자 포함 시 구분

-- UI
opt.termguicolors = true   -- 24-bit 컬러
opt.cursorline = true      -- 현재 줄 하이라이트
opt.signcolumn = "yes"     -- 항상 사인 컬럼 표시 (LSP 진단 등)
opt.splitright = true      -- vsplit 시 오른쪽으로
opt.splitbelow = true      -- split 시 아래로

-- 성능
opt.updatetime = 250       -- CursorHold 이벤트 딜레이 (ms)
opt.timeoutlen = 300       -- 키 조합 대기 시간 (ms)
opt.undofile = true        -- 영구 undo 히스토리
```

## 4단계: 핵심 플러그인 3종 설치

### Telescope — 퍼지 파인더

`~/.config/nvim/lua/plugins/editor.lua`:

```lua
-- editor.lua: 파일 탐색 및 편집 보조 플러그인
return {
  {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      { "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
    },
    keys = {
      -- 지연 로딩: 아래 키를 누를 때만 로드됨
      { "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "파일 검색" },
      { "<leader>fg", "<cmd>Telescope live_grep<cr>",  desc = "내용 검색" },
      { "<leader>fb", "<cmd>Telescope buffers<cr>",    desc = "버퍼 목록" },
      { "<leader>fh", "<cmd>Telescope help_tags<cr>",  desc = "도움말 검색" },
    },
    config = function()
      require("telescope").setup({
        defaults = { file_ignore_patterns = { "node_modules", ".git/" } },
        extensions = { fzf = {} },
      })
      require("telescope").load_extension("fzf")
    end,
  },
}
```

### Treesitter — 구문 강조

`~/.config/nvim/lua/plugins/treesitter.lua`:

```lua
-- treesitter.lua: 구문 트리 기반 코드 강조 및 편집 기능
return {
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    event = { "BufReadPost", "BufNewFile" },  -- 파일 열 때 로드
    config = function()
      require("nvim-treesitter.configs").setup({
        ensure_installed = {
          "lua", "python", "javascript", "typescript",
          "rust", "go", "bash", "json", "yaml", "markdown",
        },
        highlight = { enable = true },
        indent = { enable = true },
        incremental_selection = {
          enable = true,
          keymaps = {
            init_selection = "<C-space>",
            node_incremental = "<C-space>",
            scope_incremental = false,
            node_decremental = "<bs>",
          },
        },
      })
    end,
  },
}
```

### nvim-lspconfig — LSP 연동

`~/.config/nvim/lua/plugins/lsp.lua`:

```lua
-- lsp.lua: LSP 서버 설정 및 자동완성 연동
return {
  -- LSP 서버 자동 설치 관리자
  {
    "williamboman/mason.nvim",
    cmd = "Mason",
    build = ":MasonUpdate",
    config = true,
  },
  {
    "williamboman/mason-lspconfig.nvim",
    dependencies = { "williamboman/mason.nvim", "neovim/nvim-lspconfig" },
    opts = {
      ensure_installed = { "lua_ls", "pyright", "tsserver", "rust_analyzer" },
      automatic_installation = true,
    },
  },
  -- 자동완성
  {
    "hrsh7th/nvim-cmp",
    event = "InsertEnter",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "L3MON4D3/LuaSnip",
      "saadparwaiz1/cmp_luasnip",
    },
    config = function()
      local cmp = require("cmp")
      cmp.setup({
        snippet = {
          expand = function(args)
            require("luasnip").lsp_expand(args.body)
          end,
        },
        mapping = cmp.mapping.preset.insert({
          ["<C-b>"] = cmp.mapping.scroll_docs(-4),
          ["<C-f>"] = cmp.mapping.scroll_docs(4),
          ["<C-Space>"] = cmp.mapping.complete(),
          ["<CR>"] = cmp.mapping.confirm({ select = true }),
          ["<Tab>"] = cmp.mapping.select_next_item(),
          ["<S-Tab>"] = cmp.mapping.select_prev_item(),
        }),
        sources = cmp.config.sources({
          { name = "nvim_lsp" },
          { name = "luasnip" },
          { name = "buffer" },
          { name = "path" },
        }),
      })
    end,
  },
}
```

## 5단계: UI 테마 설정

`~/.config/nvim/lua/plugins/ui.lua`:

```lua
-- ui.lua: 컬러 테마, 상태바, 파일트리 UI 플러그인
return {
  -- 컬러 테마 (TokyoNight)
  {
    "folke/tokyonight.nvim",
    lazy = false,    -- 시작 시 즉시 로드 (테마는 지연 불가)
    priority = 1000, -- 다른 플러그인보다 먼저 로드
    config = function()
      require("tokyonight").setup({ style = "moon" })
      vim.cmd.colorscheme("tokyonight")
    end,
  },
  -- 상태바
  {
    "nvim-lualine/lualine.nvim",
    event = "VeryLazy",
    opts = {
      options = { theme = "tokyonight", globalstatus = true },
    },
  },
  -- 파일트리
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = { "nvim-lua/plenary.nvim", "nvim-tree/nvim-web-devicons", "MunifTanjim/nui.nvim" },
    keys = { { "<leader>e", "<cmd>Neotree toggle<cr>", desc = "파일트리 토글" } },
  },
}
```

## 성능 측정 및 최적화

설정 완료 후 시작 시간을 측정하자:

```bash
# 평균 시작 시간 측정 (10회)
hyperfine "nvim --headless +qa" --warmup 3

# 또는 내장 명령어로 측정
nvim --startuptime /tmp/nvim-startup.log +q
tail -1 /tmp/nvim-startup.log
```

| 구성 | 시작 시간 | 로드된 플러그인 |
|------|----------|----------------|
| 지연 로딩 없음 | ~180ms | 전체 즉시 로드 |
| lazy.nvim 기본 | ~60ms | 필수 플러그인만 |
| 최적화 후 | **38ms** | 이벤트 기반 로드 |

Neovim 안에서 `:Lazy profile` 명령어를 실행하면 각 플러그인의 로드 시간을 GUI로 확인할 수 있다.

> [!TIP]
> 지연 로딩 키워드: `event = "BufReadPost"` (파일 열기), `ft = "python"` (특정 파일타입), `cmd = "Mason"` (명령어 실행), `keys = {...}` (단축키). 이 4가지를 적극 활용하면 시작 시간을 크게 줄일 수 있다.

## 자주 만나는 문제 4가지

| 증상 | 원인 | 해결 |
|------|------|------|
| `module 'xxx' not found` | 플러그인 미설치 | `:Lazy sync` 실행 |
| 아이콘이 깨짐 (`?` 표시) | Nerd Font 미설치 | 터미널 폰트를 Nerd Font로 변경 |
| LSP가 동작 안 함 | 서버 미설치 | `:Mason` → 해당 LSP 서버 설치 |
| Treesitter 파서 오류 | 파서 버전 불일치 | `:TSUpdate` 실행 |

> [!WARNING]
> `~/.config/nvim/` 하위에 기존 설정이 있다면 백업 후 시작하자. lazy.nvim은 `~/.local/share/nvim/lazy/`에 플러그인을 저장하므로, 기존 packer 플러그인 경로(`~/.local/share/nvim/site/pack/`)와 충돌하지는 않지만, `init.lua`가 두 관리자를 동시에 참조하면 로드 오류가 발생한다.

## 권장 추가 플러그인

기본 세팅 이후 작업 환경에 따라 추가를 고려할 플러그인:

| 플러그인 | 용도 | 지연 로딩 트리거 |
|---------|------|----------------|
| `lewis6991/gitsigns.nvim` | Git 변경 사인 표시 | `BufReadPost` |
| `folke/which-key.nvim` | 키 힌트 팝업 | `VeryLazy` |
| `echasnovski/mini.pairs` | 자동 괄호 닫기 | `InsertEnter` |
| `numToStr/Comment.nvim` | 주석 토글 | `keys` |
| `stevearc/conform.nvim` | 코드 포맷터 | `BufWritePre` |
| `folke/trouble.nvim` | LSP 진단 목록 | `cmd` |

> [!CAUTION]
> 플러그인은 적을수록 좋다. 처음에 필요해 보여서 설치한 플러그인 30개가 나중에 충돌·오류의 원인이 된다. Telescope, Treesitter, LSP 3축을 먼저 완전히 익힌 뒤 필요에 따라 하나씩 추가하자. `:Lazy profile`로 정기적으로 시작 시간을 확인하고, 100ms를 넘으면 어떤 플러그인이 원인인지 추적한다.

## 관련 글

- [SSH 키 로테이션 자동화 — 연 1회 보안 위생](/posts/linux/server/ssh-key-rotation): 개발 환경 서버 접속에 사용하는 SSH 키도 주기적으로 교체하자.

## 정리

- [ ] Neovim 0.9+ 설치 확인
- [ ] ripgrep, fd, Node.js 사전 도구 설치
- [ ] `~/.config/nvim/lua/config/lazy.lua` 부트스트랩 작성
- [ ] `lua/plugins/` 디렉터리 구조 생성
- [ ] Telescope, Treesitter, LSP 플러그인 파일 작성
- [ ] `:Lazy sync`로 플러그인 설치
- [ ] `:Mason`으로 LSP 서버 설치
- [ ] `nvim --startuptime`으로 시작 시간 측정 (목표: 60ms 이하)
- [ ] `:Lazy profile`로 느린 플러그인 확인 및 지연 로딩 적용

:bulb: **핵심**: lazy.nvim의 지연 로딩은 `keys`, `event`, `ft`, `cmd` 중 하나를 지정하는 것만으로 활성화된다. 테마 같이 반드시 즉시 로드해야 하는 것만 `lazy = false`를 명시하면 된다.
