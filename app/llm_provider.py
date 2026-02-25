import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")

def get_llm_client():
    if LLM_PROVIDER == "openai":
        return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    elif LLM_PROVIDER == "bedrock":
        import boto3
        return boto3.client(
            service_name="bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-1")
        )
    else:
        raise ValueError(f"Unknown LLM provider: {LLM_PROVIDER}")

def generate_completion(prompt: str, system: str) -> str:
    if LLM_PROVIDER == "openai":
        client = get_llm_client()
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    
    elif LLM_PROVIDER == "bedrock":
        import json
        client = get_llm_client()
        body = json.dumps({
            "prompt": f"\n\nHuman: {prompt}\n\nAssistant:",
            "max_tokens_to_sample": 2000,
        })
        response = client.invoke_model(
            body=body,
            modelId="anthropic.claude-v2",
            contentType="application/json",
            accept="application/json"
        )
        response_body = json.loads(response.get("body").read())
        return response_body.get("completion")