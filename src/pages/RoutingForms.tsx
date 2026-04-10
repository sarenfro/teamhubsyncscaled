import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";

interface Question {
  id: string;
  label: string;
  type: "text" | "select" | "radio";
  options?: string[];
  required: boolean;
}

interface RoutingRule {
  id: string;
  question_id: string;
  value: string;
  target_event_type_id: string;
}

interface EventType {
  id: string;
  title: string;
  slug: string;
}

interface RoutingForm {
  id: string;
  title: string;
  is_active: boolean;
  questions: Question[];
  routing_rules: RoutingRule[];
  event_type_id: string | null;
}

const RoutingForms = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [forms, setForms] = useState<RoutingForm[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoutingForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: formsData }, { data: eventsData }] = await Promise.all([
        supabase
          .from("routing_forms")
          .select("*")
          .eq("owner_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("event_types")
          .select("id, title, slug")
          .eq("owner_user_id", user.id)
          .eq("is_active", true),
      ]);
      if (formsData) setForms(formsData.map(f => ({
        ...f,
        questions: (f.questions || []) as unknown as Question[],
        routing_rules: (f.routing_rules || []) as unknown as RoutingRule[],
      })));
      if (eventsData) setEventTypes(eventsData);
      setLoading(false);
    };
    load();
  }, [user]);

  const createForm = async () => {
    if (!user) return;
    const newForm = {
      title: "New Routing Form",
      owner_user_id: user.id,
      questions: [{ id: crypto.randomUUID(), label: "What is this about?", type: "select" as const, options: ["Sales", "Support", "General"], required: true }],
      routing_rules: [],
      is_active: true,
    };
    const { data, error } = await supabase.from("routing_forms").insert(newForm).select().single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    const created = {
      ...data,
      questions: data.questions as unknown as Question[],
      routing_rules: data.routing_rules as unknown as RoutingRule[],
    };
    setForms(prev => [created, ...prev]);
    setEditing(created);
  };

  const saveForm = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("routing_forms")
      .update({
        title: editing.title,
        questions: editing.questions as any,
        routing_rules: editing.routing_rules as any,
        event_type_id: editing.event_type_id,
        is_active: editing.is_active,
      })
      .eq("id", editing.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved" });
      setForms(prev => prev.map(f => f.id === editing.id ? editing : f));
      setEditing(null);
    }
    setSaving(false);
  };

  const deleteForm = async (id: string) => {
    const { error } = await supabase.from("routing_forms").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setForms(prev => prev.filter(f => f.id !== id));
      if (editing?.id === id) setEditing(null);
    }
  };

  const addQuestion = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      questions: [
        ...editing.questions,
        { id: crypto.randomUUID(), label: "", type: "text", required: false },
      ],
    });
  };

  const updateQuestion = (qId: string, updates: Partial<Question>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      questions: editing.questions.map(q => q.id === qId ? { ...q, ...updates } : q),
    });
  };

  const removeQuestion = (qId: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      questions: editing.questions.filter(q => q.id !== qId),
      routing_rules: editing.routing_rules.filter(r => r.question_id !== qId),
    });
  };

  const addRoutingRule = () => {
    if (!editing || editing.questions.length === 0) return;
    setEditing({
      ...editing,
      routing_rules: [
        ...editing.routing_rules,
        { id: crypto.randomUUID(), question_id: editing.questions[0].id, value: "", target_event_type_id: "" },
      ],
    });
  };

  const updateRule = (rId: string, updates: Partial<RoutingRule>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      routing_rules: editing.routing_rules.map(r => r.id === rId ? { ...r, ...updates } : r),
    });
  };

  const removeRule = (rId: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      routing_rules: editing.routing_rules.filter(r => r.id !== rId),
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Routing Forms</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Ask pre-booking questions and route to the right event type.
              </p>
            </div>
            <Button variant="booking" size="sm" onClick={createForm}>
              <Plus className="h-4 w-4 mr-1" /> New Form
            </Button>
          </div>
        </div>

        {/* Editing view */}
        {editing && (
          <div className="rounded-xl border border-border p-6 space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Form Title</label>
              <Input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Default Event Type</label>
              <Select
                value={editing.event_type_id || "none"}
                onValueChange={(v) => setEditing({ ...editing, event_type_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Select default event type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (use routing rules)</SelectItem>
                  {eventTypes.map(et => (
                    <SelectItem key={et.id} value={et.id}>{et.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Questions</h3>
                <Button variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
                </Button>
              </div>
              {editing.questions.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Input
                        value={q.label}
                        onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                        placeholder="Question label"
                      />
                      <div className="flex gap-2">
                        <Select
                          value={q.type}
                          onValueChange={(v) => updateQuestion(q.id, { type: v as any })}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="select">Dropdown</SelectItem>
                            <SelectItem value="radio">Radio</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={q.required}
                            onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                          />
                          Required
                        </label>
                      </div>
                      {(q.type === "select" || q.type === "radio") && (
                        <Input
                          value={(q.options || []).join(", ")}
                          onChange={(e) => updateQuestion(q.id, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                          placeholder="Options (comma-separated)"
                        />
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Routing Rules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Routing Rules</h3>
                <Button variant="outline" size="sm" onClick={addRoutingRule} disabled={editing.questions.length === 0}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Route responses to specific event types based on answers.</p>
              {editing.routing_rules.map(rule => {
                const question = editing.questions.find(q => q.id === rule.question_id);
                return (
                  <div key={rule.id} className="rounded-lg border border-border p-3 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">If</span>
                    <Select
                      value={rule.question_id}
                      onValueChange={(v) => updateRule(rule.id, { question_id: v })}
                    >
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {editing.questions.map(q => (
                          <SelectItem key={q.id} value={q.id}>{q.label || `Q${editing.questions.indexOf(q) + 1}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">=</span>
                    {question && (question.type === "select" || question.type === "radio") && question.options ? (
                      <Select
                        value={rule.value}
                        onValueChange={(v) => updateRule(rule.id, { value: v })}
                      >
                        <SelectTrigger className="w-32"><SelectValue placeholder="Value" /></SelectTrigger>
                        <SelectContent>
                          {question.options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        placeholder="Answer value"
                        className="w-32"
                      />
                    )}
                    <span className="text-sm text-muted-foreground">→</span>
                    <Select
                      value={rule.target_event_type_id}
                      onValueChange={(v) => updateRule(rule.id, { target_event_type_id: v })}
                    >
                      <SelectTrigger className="w-40"><SelectValue placeholder="Event type" /></SelectTrigger>
                      <SelectContent>
                        {eventTypes.map(et => (
                          <SelectItem key={et.id} value={et.id}>{et.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button variant="booking" onClick={saveForm} disabled={saving}>
                {saving ? "Saving..." : "Save Form"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* List */}
        {!editing && forms.length === 0 && (
          <div className="rounded-xl border border-border p-10 text-center space-y-3">
            <p className="text-muted-foreground">No routing forms yet.</p>
            <p className="text-sm text-muted-foreground">Create one to ask pre-booking questions and route to the right event type.</p>
          </div>
        )}

        {!editing && forms.map(form => (
          <div key={form.id} className="rounded-xl border border-border p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{form.title}</p>
              <p className="text-sm text-muted-foreground">
                {form.questions.length} question{form.questions.length !== 1 ? "s" : ""} · {form.routing_rules.length} rule{form.routing_rules.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(form)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => deleteForm(form.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoutingForms;
