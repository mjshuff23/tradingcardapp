#!/bin/bash
# This script generates a dump of the project structure and file contents, excluding certain patterns.

IGNORE_PATTERN="node_modules|\.git|dist|build|package-lock\.json|yarn\.lock|project-dump\.txt|.*\.txt"

OUTPUT_FILE="project-dump.txt"

FILE_LIST=$(git ls-files -co --exclude-standard 2>/dev/null)
FILTERED_FILE_LIST=$(printf "%s\n" "$FILE_LIST" | grep -vE "$IGNORE_PATTERN" || true)

{
    echo "--- PROJECT STRUCTURE ---"
    if command -v tree >/dev/null 2>&1; then
        if [ -n "$FILTERED_FILE_LIST" ]; then
            printf "%s\n" "$FILTERED_FILE_LIST" | tree --fromfile
        else
            tree -I "$IGNORE_PATTERN"
        fi
    else
        if [ -n "$FILTERED_FILE_LIST" ]; then
            printf "%s\n" "$FILTERED_FILE_LIST"
        else
            find . -type f | grep -vE "$IGNORE_PATTERN"
        fi
    fi

    echo -e "\n--- FILE CONTENTS ---"

    if [ -n "$FILTERED_FILE_LIST" ]; then
        printf "%s\n" "$FILTERED_FILE_LIST" | while read -r file; do
            if [ -f "$file" ]; then
                echo "========================================"
                echo "FILE: $file"
                echo "========================================"
                cat "$file"
                echo -e "\n"
            fi
        done
    else
        find . -type f | grep -vE "$IGNORE_PATTERN" | while read -r file; do
            echo "========================================"
            echo "FILE: $file"
            echo "========================================"
            cat "$file"
            echo -e "\n"
        done
    fi
} > "$OUTPUT_FILE"

echo "Wrote project dump to $OUTPUT_FILE"
