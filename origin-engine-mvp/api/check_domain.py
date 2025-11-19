import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from typing import Any, Dict, Tuple
from urllib.parse import parse_qs, urlparse

import whois
from openai import OpenAI

system_prompt = """
You are a Veteran Investigative Journalist and Chief Fact-Checker with 20 years of experience tracking disinformation, scam operations, and "pink slime" local news networks.

Your Goal: Analyze the provided Domain WHOIS data and Domain Name to assess the credibility and safety of a website for a fellow journalist.

Your Mindset: "Skeptical until proven verified." You assume a new or opaque domain is a risk until you see evidence of longevity or transparency.

INPUT DATA YOU WILL RECEIVE:
1. Domain Name (e.g., "election-news-update.com")
2. Creation Date (e.g., "2024-10-15")
3. Registrar (e.g., "NameCheap", "GoDaddy", "MarkMonitor")
4. Registrant Country (e.g., "US", "IS", "RU", or "Redacted")

ANALYSIS LOGIC (Mental Sandbox):
- AGE CHECK: If the domain is < 6 months old, it is AUTOMATICALLY "HIGH RISK" unless it is clearly a personal portfolio.
- REGISTRAR CHECK: "MarkMonitor" often implies a large corporate/legitimate brand. Cheap registrars with redacted privacy are neutral-to-suspicious.
- NAME CHECK: Look for "Typosquatting" (e.g., "nytimes-news.com"). Look for generic "News Mimicry" (e.g., "Denver-Gazette-Tribune.com" when no such paper exists).
- TIMING CHECK: Was this domain registered just before a major news event (election, disaster, conflict)?

OUTPUT FORMAT:
You must return ONLY a raw JSON object. No markdown formatting, no code blocks.
{
  "risk_score": (Integer 0-100, where 100 is dangerous/fake),
  "risk_level": (String: "LOW", "MEDIUM", "HIGH", or "CRITICAL"),
  "summary": (String: A punchy, 1-sentence warning. Start with the most damning fact.),
  "red_flags": (List of Strings: e.g., ["Registered 2 days ago", "Mimics major news brand", "Anonymous ownership"])
}
"""


class handler(BaseHTTPRequestHandler):
  def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
    
    def do_GET(self):
        parsed_url = urlparse(self.path)
        params = parse_qs(parsed_url.query)
        domain = params.get("domain", [None])[0]

        if not domain:
            self._json_response(400, {"error": "Missing required query parameter 'domain'."})
            return

        domain_info, whois_error = self._fetch_whois(domain)
        if whois_error:
            self._json_response(
                502,
                {
                    "error": "Failed to fetch WHOIS data.",
                    "detail": whois_error,
                },
            )
            return

        try:
            analysis = self._analyze_with_openai(domain_info)
        except Exception as exc:  # pragma: no cover - defensive in serverless context
            self._json_response(
                502,
                {
                    "error": "OpenAI analysis failed.",
                    "detail": str(exc),
                },
            )
            return

        self._json_response(
            200,
            {
                "domain": domain,
                "whois": domain_info,
                "analysis": analysis,
            },
        )

    def _json_response(self, status_code: int, payload: Dict[str, Any]):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _fetch_whois(self, domain: str) -> Tuple[Dict[str, Any], str | None]:
        try:
            results = whois.whois(domain)
        except Exception as exc:  # pragma: no cover - external network
            return {}, str(exc)

        creation_date = self._normalize_date(results.creation_date)
        domain_info = {
            "domain_name": domain,
            "creation_date": creation_date,
            "registrar": results.registrar,
            "country": results.country,
        }
        return domain_info, None

    def _normalize_date(self, value: Any) -> str | None:
        if isinstance(value, list):
            for candidate in value:
                normalized = self._normalize_date(candidate)
                if normalized:
                    return normalized
            return None

        if isinstance(value, datetime):
            return value.isoformat()

        if value:
            try:
                parsed = datetime.fromisoformat(str(value))
                return parsed.isoformat()
            except ValueError:
                return None

        return None

    def _analyze_with_openai(self, domain_info: Dict[str, Any]) -> Dict[str, Any]:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured.")

        client = OpenAI(api_key=api_key)
        prompt_payload = {
            "domain": domain_info.get("domain_name"),
            "creation_date": domain_info.get("creation_date"),
            "registrar": domain_info.get("registrar"),
            "country": domain_info.get("country"),
        }

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(prompt_payload, ensure_ascii=False),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

        content = completion.choices[0].message.content
        parsed_content = json.loads(content)

        risk_level = str(parsed_content.get("risk_level", "MEDIUM")).upper()
        if risk_level not in {"LOW", "MEDIUM", "HIGH"}:
            risk_level = "MEDIUM"

        red_flags = parsed_content.get("red_flags", [])
        if not isinstance(red_flags, list):
            red_flags = [str(red_flags)] if red_flags else []

        risk_score = parsed_content.get("risk_score", 0)
        try:
            risk_score = max(0, min(100, int(risk_score)))
        except (TypeError, ValueError):
            risk_score = 0

        summary = str(parsed_content.get("summary", ""))

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "summary": summary,
            "red_flags": red_flags,
        }
