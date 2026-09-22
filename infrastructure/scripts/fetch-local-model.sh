#!/usr/bin/env sh
set -eu

# Pinned community quantization of the official Qwen3-4B-Instruct-2507 model.
# The SHA-256 is the Hugging Face LFS object hash and is verified before install.
MODEL_DIR=${LOCAL_LLM_MODEL_DIR:-models}
MODEL_FILE=${LOCAL_LLM_MODEL_FILE:-Qwen3-4B-Instruct-2507-Q4_K_M.gguf}
MODEL_URL=${LOCAL_LLM_MODEL_URL:-https://huggingface.co/bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf}
MODEL_SHA256=${LOCAL_LLM_MODEL_SHA256:-2fde00ce69dd4899c70d020845e2638353015bba0fdf161b3eb965f2bca4464e}

mkdir -p "$MODEL_DIR"
TARGET="$MODEL_DIR/$MODEL_FILE"
TEMP="$TARGET.part"

curl --fail --location --retry 3 --output "$TEMP" "$MODEL_URL"
printf '%s  %s\n' "$MODEL_SHA256" "$TEMP" | sha256sum -c -
mv "$TEMP" "$TARGET"
# The llama.cpp image may run as a non-root UID; model weights are not credentials.
chmod 644 "$TARGET"
printf 'Verified local model: %s\n' "$TARGET"
