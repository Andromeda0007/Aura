import sys
sys.path.insert(0, ".")

import asyncio
from backend.app.workers.manager import run_workers

if __name__ == "__main__":
    print("Starting Aura Workers...")
    print("- STT Worker (Whisper)")
    print("- Vision Worker (OCR)")
    print("- LLM Worker (Gemini)")
    print("- Compression Worker")
    print("\nPress Ctrl+C to stop\n")
    
    try:
        asyncio.run(run_workers())
    except KeyboardInterrupt:
        print("\nShutting down workers...")
