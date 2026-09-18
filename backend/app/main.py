from fastapi import FastAPI  

#create fastapi app
app = FastAPI(
    title="AgentGuard API",
    description="Backend safety checkpoint for AI Agent blockchain payments",
    version="0.1.0",
)
#health endpoint (if http get to /api/health run this command bellow)
@app.get("/api/health")
def health_check():
    return{
        "status": "ok",
        "service": "agentguard-api",
    }