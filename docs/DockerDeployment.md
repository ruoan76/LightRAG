# LightRAG Docker Deployment

Deploy the full LightRAG stack (API + WebUI) in Docker. The image is built from the project root and includes the frontend build.

## 🚀 One-time preparation

### 1. Clone the repository

```bash
# Linux/macOS
git clone https://github.com/HKUDS/LightRAG.git
cd LightRAG
```

```powershell
# Windows PowerShell
git clone https://github.com/HKUDS/LightRAG.git
cd LightRAG
```

### 2. Create environment file and data directories

**Required:** Copy `env.example` to `.env` and set at least LLM/embedding and API keys as needed.

```bash
# Linux/macOS
cp env.example .env
mkdir -p data/rag_storage data/inputs
# Edit .env with your LLM, embedding, and optional storage config
```

```powershell
# Windows PowerShell
Copy-Item env.example .env
New-Item -ItemType Directory -Force -Path data\rag_storage, data\inputs
# Edit .env with your LLM, embedding, and optional storage config
```

**Optional:** To override storage or other options via config file, create `config.ini` (see `config.ini.example`) and uncomment the `config.ini` volume in `docker-compose.yml`.

LightRAG can be configured using environment variables in the `.env` file:

**Server Configuration**

- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 9621)

**LLM Configuration**

- `LLM_BINDING`: LLM backend to use (lollms/ollama/openai)
- `LLM_BINDING_HOST`: LLM server host URL
- `LLM_MODEL`: Model name to use

**Embedding Configuration**

- `EMBEDDING_BINDING`: Embedding backend (lollms/ollama/openai)
- `EMBEDDING_BINDING_HOST`: Embedding server host URL
- `EMBEDDING_MODEL`: Embedding model name

**RAG Configuration**

- `MAX_ASYNC`: Maximum async operations
- `MAX_TOKENS`: Maximum token size
- `EMBEDDING_DIM`: Embedding dimensions

## 🐳 Run with Docker

Use Docker or Docker Desktop on any platform (Linux, macOS, Windows x86/ARM).

### Build and start (first time or after code change)

```bash
docker compose up --build -d
```

This builds the image (Python API + bundled WebUI from `lightrag_webui/`) and starts the container. API and WebUI are served on port **9621** (override with `PORT` in `.env`).

### Start only (use existing image)

```bash
docker compose up -d
```

### Data and ports

- **Data:** Host directories are mounted so data persists:
  - `./data/rag_storage` → RAG knowledge graph and vectors
  - `./data/inputs` → optional input files
- **Config:** `.env` is mounted into the container; the app reads it at startup.

### Build optimization

The Dockerfile uses BuildKit cache mounts for faster rebuilds:

- BuildKit is enabled via `# syntax=docker/dockerfile:1`
- Only changed layers (e.g. after `uv.lock` or `bun.lock` changes) are rebuilt
- UV and Bun caches are reused across builds

### Update and restart

When using the pre-built image from the registry:

```bash
docker compose pull
docker compose down
docker compose up -d
```

When building from source (e.g. after `git pull`):

```bash
docker compose up --build -d
```

### Offline deployment

Software packages requiring `transformers`, `torch`, or `cuda` will is not preinstalled in the dokcer images. Consequently, document extraction tools such as Docling, as well as local LLM models like Hugging Face and LMDeploy, can not be used in an off line enviroment. These high-compute-resource-demanding services should not be integrated into LightRAG. Docling will be decoupled and deployed as a standalone service.

## 📦 Build Docker Images

### For local development and testing

```bash
# Build and run with Docker Compose (BuildKit automatically enabled)
docker compose up --build

# Or explicitly enable BuildKit if needed
DOCKER_BUILDKIT=1 docker compose up --build
```

**Note**: BuildKit is automatically enabled by the `# syntax=docker/dockerfile:1` directive in the Dockerfile, ensuring optimal caching performance.

### For production release

 **multi-architecture build and push**:

```bash
# Use the provided build script
./docker-build-push.sh
```

**The build script will**:

- Check Docker registry login status
- Create/use buildx builder automatically
- Build for both AMD64 and ARM64 architectures
- Push to GitHub Container Registry (ghcr.io)
- Verify the multi-architecture manifest

**Prerequisites**:

Before building multi-architecture images, ensure you have:

- Docker 20.10+ with Buildx support
- Sufficient disk space (20GB+ recommended for offline image)
- Registry access credentials (if pushing images)
