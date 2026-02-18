import json
from typing import Dict, List, Optional, Any
import google.generativeai as genai
import structlog

from ..core.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

genai.configure(api_key=settings.GEMINI_API_KEY)


class AIService:
    def __init__(self):
        self.flash_model = genai.GenerativeModel("gemini-1.5-flash")
        self.pro_model = genai.GenerativeModel("gemini-1.5-pro")

    async def classify_intent(self, command: str) -> str:
        prompt = f"""Classify the following command into one of these intents:
- generate_quiz: User wants to create a quiz
- summarize: User wants a summary
- explain: User wants an explanation of a concept
- generate_example: User wants an example
- answer_question: User is asking a specific question
- other: Command doesn't match above intents

Command: "{command}"

Respond with ONLY the intent name, nothing else."""

        try:
            response = self.flash_model.generate_content(prompt)
            intent = response.text.strip().lower()
            
            valid_intents = [
                "generate_quiz",
                "summarize",
                "explain",
                "generate_example",
                "answer_question",
                "other"
            ]
            
            if intent not in valid_intents:
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
- Optionally add a brief explanation

Respond ONLY with valid JSON in this exact format:
{{
  "title": "Quiz Title",
  "questions": [
    {{
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation (optional)"
    }}
  ]
}}"""

        try:
            response = self.pro_model.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            
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
  "keyPoints": ["Point 1", "Point 2", ...],
  "topics": ["Topic 1", "Topic 2", ...]
}}"""

        try:
            response = self.flash_model.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            
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

Provide a clear, concise explanation suitable for the student's level.

Respond ONLY with valid JSON:
{{
  "title": "Concept Name",
  "content": "Detailed explanation"
}}"""

        try:
            response = self.pro_model.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            
            explanation = json.loads(text.strip())
            
            logger.info("Explanation generated")
            return explanation
        except Exception as e:
            logger.error("Explanation generation failed", error=str(e))
            raise

    async def generate_example(self, context: str, command: str) -> Dict[str, Any]:
        prompt = f"""Based on the lecture context, provide a relevant example.

LECTURE CONTEXT:
{context}

USER REQUEST: {command}

Provide a practical, easy-to-understand example.

Respond ONLY with valid JSON:
{{
  "title": "Example",
  "content": "Example description"
}}"""

        try:
            response = self.pro_model.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            
            example = json.loads(text.strip())
            
            logger.info("Example generated")
            return example
        except Exception as e:
            logger.error("Example generation failed", error=str(e))
            raise

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
  "topicFlow": ["Topic 1", "Topic 2", ...],
  "keyConcepts": {{"concept": "definition", ...}},
  "visualReferences": [{{"timestamp": "...", "content": "..."}}],
  "dependencies": ["Concept A depends on B", ...]
}}"""

        try:
            response = self.flash_model.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            
            compressed = json.loads(text.strip())
            
            logger.info("Context compressed successfully")
            return compressed
        except Exception as e:
            logger.error("Context compression failed", error=str(e))
            return self._simple_compression(buffer)

    def _simple_compression(self, buffer: List[Dict]) -> Dict[str, Any]:
        logger.warning("Using simple compression fallback")
        
        all_text = " ".join([item.get("text", "") for item in buffer if item.get("type") == "transcript"])
        words = all_text.split()
        
        unique_words = list(set(words))[:10]
        
        timestamps = [item.get("timestamp") for item in buffer if "timestamp" in item]
        time_range = f"{min(timestamps)} - {max(timestamps)}" if timestamps else "unknown"
        
        return {
            "topicFlow": unique_words[:5],
            "keyConcepts": {word: "mentioned" for word in unique_words},
            "visualReferences": [],
            "dependencies": [],
            "note": "Simplified compression - LLM unavailable",
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
