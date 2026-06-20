"""Opt-in LIVE eval of the Aura command pipeline.

Runs a battery of real commands through the actual classifier (Groq/Gemini) and
spotlights a few real generations (diagram, chemistry via PubChem, image via
Pollinations, numerical, list, fact). Manual review tool — NOT a pytest (lives
in scripts/ so CI never hits the network).

    cd backend && .venv/bin/python scripts/eval_intents.py

Requires GROQ_API_KEY (or GEMINI_API_KEY) in .env; exits early otherwise.
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.models.enums import CommandIntent  # noqa: E402
from app.services.ai_service import ai_service  # noqa: E402

# (command, expected intent value)
BATTERY: list[tuple[str, str]] = [
    ("make a quiz on this lecture", "generate_quiz"),
    ("summarize what we covered", "summarize"),
    ("explain gradient descent", "explain"),
    ("work through an example of integration by parts", "generate_example"),
    ("make a numerical on momentum", "generate_numerical"),
    ("calculate the kinetic energy of a 2kg ball moving at 3 m/s", "generate_numerical"),
    ("draw the RNN architecture with nodes and edges", "generate_diagram"),
    ("make a flow diagram of backpropagation", "generate_diagram"),
    ("diagram the TCP handshake", "generate_diagram"),
    ("draw a binary search tree with 8 3 10 1 6 14 and show the inorder traversal", "generate_diagram"),
    ("draw a stack", "generate_diagram"),
    ("draw a queue", "generate_diagram"),
    ("draw a hash map", "generate_diagram"),
    ("draw the free body diagram of a block on an incline with friction", "generate_image"),
    ("draw the banking of a road", "generate_image"),
    ("draw benzene", "generate_chemistry"),
    ("create benzene", "generate_chemistry"),
    ("show me the structure of caffeine", "generate_chemistry"),
    ("make an image of a neuron", "generate_image"),
    ("generate a picture of a mitochondria", "generate_image"),
    ("list the applications of CNNs", "list_items"),
    ("what are the uses of recursion", "list_items"),
    ("give an interesting fact about backprop", "generate_fact"),
    ("fun fact about the speed of light", "generate_fact"),
    ("what is the chain rule", "answer_question"),
    ("why does dropout reduce overfitting", "answer_question"),
    ("clean up the board", "format_board"),
]

CONTEXT = (
    "Today's lecture covered convolutional neural networks (CNNs): convolution, pooling, "
    "ReLU, backpropagation, and gradient descent. We also touched on binary search trees."
)


def _preview(text: str, n: int = 70) -> str:
    t = " ".join(str(text).split())
    return t[:n] + ("…" if len(t) > n else "")


async def classify_battery() -> None:
    print("\n=== CLASSIFICATION ===")
    print(f"{'ok':<3}{'command':<60}{'predicted':<20}{'expected':<20}{'ms':>6}")
    ok_count = 0
    for command, expected in BATTERY:
        t0 = time.time()
        intent = await ai_service.classify_intent(command)
        ms = int((time.time() - t0) * 1000)
        ok = intent.value == expected
        ok_count += ok
        print(f"{'✓' if ok else '✗':<3}{_preview(command, 58):<60}{intent.value:<20}{expected:<20}{ms:>6}")
        await asyncio.sleep(1.2)  # stay under the Groq free-tier rate limit
    print(f"\nclassification accuracy: {ok_count}/{len(BATTERY)}")


async def spotlight() -> None:
    print("\n=== GENERATION SPOTLIGHT ===")

    d = await ai_service.generate_diagram(CONTEXT, "draw a binary search tree with 8 3 10 1 6 14 and the inorder visit order")
    print(f"\n[diagram] kind={d.get('kind')} title={d.get('title')!r}")
    print(d.get("mermaid", d.get("error")))

    c = await ai_service.generate_chemistry("create benzene")
    print(f"\n[chemistry] name={c.get('name')!r} cid={c.get('cid')} smiles={c.get('smiles')!r}")
    print(f"            imageUrl={c.get('imageUrl')}")

    img = await ai_service.generate_image("make an image of a neuron")
    print(f"\n[image] prompt={_preview(img.get('prompt',''))!r}")
    print(f"        imageUrl={img.get('imageUrl')}")

    num = await ai_service.generate_numerical(CONTEXT, "calculate the kinetic energy of a 2kg ball at 3 m/s")
    print(f"\n[numerical] answer={num.get('answer')!r} unit={num.get('unit')!r} tol={num.get('tolerance')}")
    print(f"            problem={_preview(num.get('problem',''))}")

    lst = await ai_service.list_items(CONTEXT, "list the applications of CNNs")
    print(f"\n[list] title={lst.get('title')!r}")
    print(f"       items={lst.get('items')}")

    fact = await ai_service.generate_fact(CONTEXT, "fun fact about the speed of light")
    print(f"\n[fact] {_preview(fact.get('fact',''), 120)}  (source={fact.get('source')!r})")


async def main() -> None:
    if not settings.ai_enabled:
        print("No GROQ_API_KEY / GEMINI_API_KEY set — skipping live eval.")
        return
    await classify_battery()
    await spotlight()


if __name__ == "__main__":
    asyncio.run(main())
