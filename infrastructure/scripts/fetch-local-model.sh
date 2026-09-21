#!/usr/bin/env sh
set -eu

# Download only a model artifact accompanied by a publisher-provided SHA-256.
MODEL_DIR=${LOCAL_LLM_MODEL_DIR:-models}
MODEL_FILE=${LOCAL_LLM_MODEL_FILE:-Qwen3.5-9B-Q5_K_M.gguf}
: "${LOCAL_LLM_MODEL_URL:?Set LOCAL_LLM_MODEL_URL to the approved GGUF download URL}"
: "${LOCAL_LLM_MODEL_SHA256:?Set LOCAL_LLM_MODEL_SHA256 to the approved SHA-256}"

mkdir -p "$MODEL_DIR"
TARGET="$MODEL_DIR/$MODEL_FILE"
TEMP="$TARGET.part"

curl --fail --location --retry 3 --output "$TEMP" "$LOCAL_LLM_MODEL_URL"
printf '%s  %s\n' "$LOCAL_LLM_MODEL_SHA256" "$TEMP" | sha256sum -c -
mv "$TEMP" "$TARGET"
# The llama.cpp image may run as a non-root UID; model weights are not credentials.
chmod 644 "$TARGET"
printf 'Verified local model: %s\n' "$TARGET"
