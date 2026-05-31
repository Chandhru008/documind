fetch("http://localhost:3001/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-session-id": "test_session_123"
  },
  body: JSON.stringify({ question: "Hello" })
})
.then(res => res.text())
.then(console.log)
.catch(console.error);
