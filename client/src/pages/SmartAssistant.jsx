import { Bot, Send } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../components/PageHeader";
import api from "../services/api";

const examples = [
  "Which animals need vaccines?",
  "Which animals are sick?",
  "Which crops are ready for harvest?",
  "Show animals close to giving birth",
  "How is my profit this month?"
];

export default function SmartAssistant() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ask me about vaccines, sick animals, harvest readiness, expected births, or monthly profit." }
  ]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(text = question) {
    const clean = text.trim();
    if (!clean) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: clean }]);
    setLoading(true);
    try {
      const { data } = await api.post("/ai/assistant", { question: clean });
      setMessages((current) => [...current, { role: "assistant", text: data.answer }]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Assistant could not answer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Smart Assistant" eyebrow="Rule-based farm intelligence" />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card flex min-h-[560px] flex-col p-5">
          <div className="space-y-3 overflow-auto">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={message.role === "user" ? "max-w-[82%] rounded-lg bg-farm-700 px-4 py-3 text-sm text-white" : "max-w-[82%] whitespace-pre-line rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700"}>
                  {message.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-slate-500">Thinking through farm records...</div>}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); ask(); }} className="mt-auto flex gap-2 pt-4">
            <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a farm question" />
            <button className="btn-primary" disabled={loading}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        <aside className="card p-5">
          <div className="mb-4 flex items-center gap-2 text-farm-950">
            <Bot className="h-5 w-5" />
            <h2 className="font-bold">Try asking</h2>
          </div>
          <div className="space-y-2">
            {examples.map((example) => (
              <button key={example} className="btn-muted w-full justify-start text-left" onClick={() => ask(example)}>
                {example}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg bg-farm-50 p-3 text-sm text-slate-600">
            This assistant uses local rules and your stored farm data only. No paid AI API is called.
          </div>
        </aside>
      </div>
    </div>
  );
}
