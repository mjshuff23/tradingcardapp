#!/bin/bash
# This script generates a dump of the project structure and file contents, excluding certain patterns.

IGNORE_PATTERN="node_modules|\.git|dist|build|package-lock\.json|yarn\.lock|project-dump\.txt|.*\.txt"

OUTPUT_FILE="project-dump.txt"

{
    echo "--- PROJECT STRUCTURE ---"
    tree -I "$IGNORE_PATTERN"

    echo -e "\n--- FILE CONTENTS ---"

    find . -type f | grep -vE "$IGNORE_PATTERN" | while read -r file; do
        echo "========================================"
        echo "FILE: $file"
        echo "========================================"
        cat "$file"
        echo -e "\n"
    done
} > "$OUTPUT_FILE"

echo "Wrote project dump to $OUTPUT_FILE"
