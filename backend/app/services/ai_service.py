import json
from typing import Dict, List, Any
import structlog

from ..core.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


def _build_client():
    """Return (client, provider) — prefers Groq, falls back to Gemini."""
    if settings.GROQ_API_KEY:
        from groq import Groq
        logger.info("AI provider: Groq")
        return Groq(api_key=settings.GROQ_API_KEY), "groq"

    if settings.GEMINI_API_KEY:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        logger.info("AI provider: Gemini")
        return genai, "gemini"

    raise RuntimeError("No AI API key configured. Set GROQ_API_KEY or GEMINI_API_KEY in .env")


class AIService:
    def __init__(self):
        self._client, self._provider = _build_client()

        if self._provider == "gemini":
            import google.generativeai as genai
            self.flash_model = genai.GenerativeModel("gemini-2.0-flash-lite")
            self.pro_model   = genai.GenerativeModel("gemini-2.0-flash")

    # ── low-level generate ────────────────────────────────────────────────────

    def _generate(self, prompt: str, model: str = "fast") -> str:
        """Generate text. model='fast' or 'smart'."""
        if self._provider == "groq":
            # fast = llama-3.1-8b-instant (30 RPM free), smart = llama-3.3-70b (30 RPM free)
            model_id = "llama-3.1-8b-instant" if model == "fast" else "llama-3.3-70b-versatile"
            response = self._client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()

        else:  # gemini
            m = self.flash_model if model == "fast" else self.pro_model
            response = m.generate_content(prompt)
            return response.text.strip()

    # ── public methods ────────────────────────────────────────────────────────

    async def classify_intent(self, command: str) -> str:
        prompt = f"""Classify the following command into one of these intents:
- generate_quiz: User wants to create a quiz or test questions
- summarize: User wants a summary of the lecture
- explain: User wants an explanation of a concept
- generate_example: User wants a worked example, numerical problem, or practice problem
- generate_diagram: User wants a diagram, flowchart, chart, visual, molecular structure, chemical structure, or any graphical representation
- answer_question: User is asking a specific factual question
- other: Command doesn't match any above intents

Command: "{command}"

Respond with ONLY the intent name, nothing else."""

        try:
            intent = self._generate(prompt, model="fast").lower().strip()
            valid = ["generate_quiz", "summarize", "explain",
                     "generate_example", "generate_diagram", "answer_question", "other"]
            if intent not in valid:
                intent = "other"
            logger.info("Intent classified", command=command[:50], intent=intent)
            return intent
        except Exception as e:
            logger.error("Intent classification failed", error=str(e))
            return "other"

    async def generate_quiz(self, context: str, command: str) -> Dict[str, Any]:
        prompt = f"""You are a teaching assistant. Based on the following lecture context, generate a quiz.

LECTURE CONTEXT:
{context}

USER REQUEST: {command}

Generate a quiz with 5 multiple-choice questions. For each question:
- Make it relevant to the context
- Provide 4 options (A, B, C, D)
- Indicate the correct answer (0, 1, 2, or 3)
- Add a brief explanation

Respond ONLY with valid JSON in this exact format:
{{
  "title": "Quiz Title",
  "questions": [
    {{
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation"
    }}
  ]
}}"""

        try:
            text = self._generate(prompt, model="smart")
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            quiz_data = json.loads(text.strip())
            logger.info("Quiz generated", questions=len(quiz_data.get("questions", [])))
            return quiz_data
        except Exception as e:
            logger.error("Quiz generation failed", error=str(e))
            raise

    async def generate_summary(self, context: str) -> Dict[str, Any]:
        prompt = f"""Summarize the following lecture content into key points.

LECTURE CONTEXT:
{context}

Provide:
1. A concise summary (2-3 sentences)
2. Key points (bullet points)
3. Main topics covered

Respond ONLY with valid JSON in this format:
{{
  "title": "Summary",
  "content": "Main summary text",
  "keyPoints": ["Point 1", "Point 2"],
  "topics": ["Topic 1", "Topic 2"]
}}"""

        try:
            text = self._generate(prompt, model="smart")
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            summary = json.loads(text.strip())
            logger.info("Summary generated")
            return summary
        except Exception as e:
            logger.error("Summary generation failed", error=str(e))
            raise

    async def explain_concept(self, context: str, command: str) -> Dict[str, Any]:
        prompt = f"""Based on the lecture context, explain the concept requested by the user.

LECTURE CONTEXT:
{context}

USER REQUEST: {command}

Provide a clear, concise explanation.

Respond ONLY with valid JSON:
{{
  "title": "Concept Name",
  "content": "Detailed explanation"
}}"""

        try:
            text = self._generate(prompt, model="smart")
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            explanation = json.loads(text.strip())
            logger.info("Explanation generated")
            return explanation
        except Exception as e:
            logger.error("Explanation generation failed", error=str(e))
            raise

    async def generate_example(self, context: str, command: str) -> Dict[str, Any]:
        prompt = f"""Based on the lecture context, create a problem or numerical for the student to solve.

LECTURE CONTEXT:
{context}

USER REQUEST: {command}

Create a practical problem that tests understanding of the topic.
Include a clear problem statement, the correct answer, and a step-by-step explanation.

Respond ONLY with valid JSON:
{{
  "title": "Problem Title",
  "problem": "Clear, complete problem statement with all necessary values and units",
  "correctAnswer": "The exact correct answer (concise, e.g. '15 N' or '9.8 m/s²')",
  "explanation": "Step-by-step solution showing how to arrive at the answer"
}}"""

        try:
            text = self._generate(prompt, model="smart")
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            example = json.loads(text.strip())
            logger.info("Example/problem generated")
            return example
        except Exception as e:
            logger.error("Example generation failed", error=str(e))
            raise

    @staticmethod
    def _clean_mermaid(code: str) -> str:
        """Fix the most common AI-generated Mermaid syntax mistakes."""
        import re
        # Fix: -->|label|> B  →  -->|label| B  (stray > after closing pipe)
        code = re.sub(r'\|([^|\n]*)\|>', r'|\1| ', code)
        # Fix: semicolons used as line separators (not valid in all Mermaid versions)
        # Only replace ; that appear at end-of-statement, not inside labels
        # Strategy: if the whole thing is on one line with semicolons, split it
        if '\n' not in code.strip() and ';' in code:
            code = code.replace(';', '\n')
        # Strip accidental markdown fences
        lines = [l for l in code.split('\n') if not l.strip().startswith('```')]
        code = '\n'.join(lines).strip()
        # Remove duplicate blank lines
        code = re.sub(r'\n{3,}', '\n\n', code)
        return code

    async def generate_diagram(self, context: str, command: str) -> Dict[str, Any]:
        prompt = f"""You are a technical diagramming assistant. Generate a diagram for the user's request.

LECTURE CONTEXT:
{context[:1500]}

USER REQUEST: {command}

STEP 1 — Choose diagram type:
- "chemistry": ONLY for named molecules/compounds (benzene, caffeine, aspirin, glucose, water, CO2, etc.)
- "mermaid": EVERYTHING else — physics concepts, processes, flows, sequences, architectures, algorithms, events, cycles, comparisons

STEP 2 — Output JSON only:

For "chemistry":
{{
  "diagramType": "chemistry",
  "title": "Title",
  "compoundName": "exact common name for API lookup",
  "smiles": "SMILES notation",
  "description": "1-2 sentences"
}}

For "mermaid":
{{
  "diagramType": "mermaid",
  "title": "Title",
  "code": "MERMAID CODE HERE",
  "description": "1 sentence"
}}

MERMAID SYNTAX — STRICT RULES (follow exactly):
1. Each node/edge MUST be on its OWN LINE — never use semicolons to separate statements
2. Arrow with label: A -->|label text| B    ← pipe BEFORE label, pipe AFTER label, then space then destination node
   WRONG: A -->|label|> B    WRONG: A-->|label|>B    CORRECT: A -->|label| B
3. Simple arrow: A --> B
4. Node shapes: A[Square]  A(Round)  A{{Diamond}}  A>Asymmetric]  A[(Database)]
5. Start line: graph TD  (top-down) or  graph LR  (left-right)
6. For sequences: sequenceDiagram
7. No backticks, no markdown fences inside the code field
8. Keep labels SHORT (2-4 words max) — long labels break rendering

EXAMPLE of correct mermaid code:
graph TD
  A[Start] --> B{{Decision}}
  B -->|Yes| C[Do it]
  B -->|No| D[Skip]
  C --> E[End]
  D --> E

Respond ONLY with valid JSON. No extra text."""

        try:
            text = self._generate(prompt, model="smart")
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            diagram = json.loads(text.strip())
            if diagram.get("diagramType") == "mermaid" and "code" in diagram:
                diagram["code"] = self._clean_mermaid(diagram["code"])
            logger.info("Diagram generated", type=diagram.get("diagramType"))
            return diagram
        except Exception as e:
            logger.error("Diagram generation failed", error=str(e))
            raise

    async def validate_answer(self, problem: str, correct_answer: str, user_answer: str) -> Dict[str, Any]:
        prompt = f"""You are a teacher checking a student's answer. Be lenient with formatting and units.

Problem: {problem}
Correct Answer: {correct_answer}
Student's Answer: {user_answer}

Is the student correct? Accept answers that are numerically equivalent even if expressed differently
(e.g. "15 N", "15 Newtons", "fifteen newtons" are all the same).

Respond ONLY with valid JSON:
{{
  "isCorrect": true or false,
  "feedback": "One encouraging sentence. If wrong, briefly hint at the correct approach without giving away the answer."
}}"""

        try:
            text = self._generate(prompt, model="fast")
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            result = json.loads(text.strip())
            logger.info("Answer validated", is_correct=result.get("isCorrect"))
            return result
        except Exception as e:
            logger.error("Answer validation failed", error=str(e))
            return {"isCorrect": False, "feedback": "Could not validate answer. Please try again."}

    async def compress_context(self, buffer: List[Dict]) -> Dict[str, Any]:
        context_text = self._format_buffer(buffer)
        prompt = f"""Compress this lecture segment into a structured summary.

CONTENT:
{context_text}

Extract:
1. Topic flow (sequence of topics discussed)
2. Key concepts with brief definitions
3. Visual references (what was drawn/shown)
4. Dependencies between concepts

Respond ONLY with valid JSON:
{{
  "topicFlow": ["Topic 1", "Topic 2"],
  "keyConcepts": {{"concept": "definition"}},
  "visualReferences": [{{"timestamp": "...", "content": "..."}}],
  "dependencies": ["Concept A depends on B"]
}}"""

        try:
            text = self._generate(prompt, model="fast")
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            compressed = json.loads(text.strip())
            logger.info("Context compressed successfully")
            return compressed
        except Exception as e:
            logger.error("Context compression failed", error=str(e))
            return self._simple_compression(buffer)

    def _simple_compression(self, buffer: List[Dict]) -> Dict[str, Any]:
        all_text  = " ".join([i.get("text", "") for i in buffer if i.get("type") == "transcript"])
        words     = list(set(all_text.split()))[:10]
        timestamps = [i.get("timestamp") for i in buffer if "timestamp" in i]
        return {
            "topicFlow": words[:5],
            "keyConcepts": {w: "mentioned" for w in words},
            "visualReferences": [],
            "dependencies": [],
            "note": "Simplified compression",
        }

    def _format_buffer(self, buffer: List[Dict]) -> str:
        lines = []
        for item in buffer:
            if item.get("type") == "transcript":
                lines.append(f"[{item.get('timestamp')}] SPEECH: {item.get('text')}")
            elif item.get("type") == "image":
                lines.append(f"[{item.get('timestamp')}] DRAWING: {item.get('ocr_text', 'Visual content')}")
        return "\n".join(lines)


ai_service = AIService()
