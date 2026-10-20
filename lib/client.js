window.__ModuleLoader__.load({id:"@jcs130/dsh-harness2",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  ExperimentView: () => ExperimentView,
  Result: () => Result,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "connection"];
var labels = {
  "not-started": "\u5C1A\u672A\u8FD0\u884C",
  running: "\u8FD0\u884C\u4E2D",
  completed: "\u5DF2\u5B8C\u6210",
  blocked: "\u5DF2\u963B\u65AD",
  failed: "\u5931\u8D25",
  cancelled: "\u5DF2\u53D6\u6D88",
  unknown: "\u672A\u77E5",
  preparing: "\u51C6\u5907",
  propose: "\u751F\u6210\u5019\u9009",
  probe: "\u8BD5\u8DD1",
  compose: "\u7EC4\u5408",
  select: "\u7B5B\u9009",
  reflect: "\u53CD\u601D",
  holdout: "\u7559\u51FA\u590D\u6D4B",
  remember: "\u4FDD\u5B58\u7ECF\u9A8C",
  settled: "\u5DF2\u7ED3\u675F"
};
var number = (v) => typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "\u2014";
var style = { background: "#111b18", color: "#dbe7e0", height: "100%", overflow: "auto", padding: "24px", boxSizing: "border-box", fontFamily: "system-ui,sans-serif" };
var card = { border: "1px solid #30483c", background: "#192720", borderRadius: 14, padding: 18, marginBottom: 14 };
var row = { display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12, color: "#b8cdc0" };
function Result({ result }) {
  const pairs = [{ name: "\u8BD5\u8DD1\u573A\u666F", ...result.train }, ...(result.holdout ?? []).map((p) => ({ name: `\u7559\u51FA \xB7 ${p.caseId}`, ...p }))];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { color: result.gate.eligible ? "#a5edb8" : "#f6d084" }, children: [
      result.gate.eligible ? "\u901A\u8FC7\u9694\u79BB\u5B9E\u9A8C\u95E8\u69DB" : "\u672A\u901A\u8FC7\u9694\u79BB\u5B9E\u9A8C\u95E8\u69DB",
      " \xB7 \u5C1A\u672A\u91C7\u7528"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { style: { width: "100%", borderCollapse: "collapse", textAlign: "left" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u573A\u666F / \u6307\u6807" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u539F\u7248" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u5019\u9009" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: pairs.flatMap((p) => Object.keys(p.baseline?.metrics ?? {}).map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { style: { padding: "8px 0" }, children: [
          p.name,
          " / ",
          key
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: number(p.baseline.metrics[key]) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: number(p.candidate?.metrics?.[key]) })
      ] }, `${p.name}-${key}`))) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { fontSize: 12, color: "#9ab3a2" }, children: [
      "\u8BC1\u636E ",
      number(result.evidenceRefs?.length),
      " \u6761 \xB7 ",
      result.lessonAvailable ? "\u6709\u53CD\u601D\u4EA7\u7269" : "\u65E0\u53CD\u601D\u4EA7\u7269",
      " \xB7 \u7ED3\u679C\u9002\u7528\u8303\u56F4\u4EE5\u8BD5\u8DD1\u573A\u666F\u4E3A\u9650"
    ] })
  ] });
}
function ExperimentView({ snapshot, error }) {
  const jobs = snapshot?.jobs ?? [], external = snapshot?.external ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { style, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { margin: "0 0 8px" }, children: "Harness\xB2 \u5B9E\u9A8C\u5BA4" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: 0, color: "#a8c0b0" }, children: "\u5019\u9009 \u2192 \u8BD5\u8DD1 \u2192 \u7EC4\u5408 \u2192 \u7B5B\u9009 \u2192 \u53CD\u601D" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: snapshot?.enabled ? "#a5edb8" : "#f6d084" }, children: snapshot?.enabled ? "\u5141\u8BB8\u5DF2\u914D\u7F6E\u5B9E\u9A8C" : "\u65B0\u5B9E\u9A8C\u672A\u542F\u7528" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { color: "#9ab3a2", lineHeight: 1.7 }, children: "\u5B9E\u9A8C\u4E0D\u4F1A\u81EA\u52A8\u66FF\u6362\u7EBF\u4E0A\u914D\u7F6E\u3002\u8FD9\u91CC\u53EA\u5C55\u793A\u6307\u6807\u548C\u8BC1\u636E\u5F15\u7528\uFF1B\u63D0\u793A\u8BCD\u3001\u56DE\u7B54\u3001\u601D\u8003\u6B63\u6587\u4E0E\u51ED\u636E\u4E0D\u8FDB\u5165\u6B64\u9875\u9762\u3002" }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", style: { color: "#f79f97" }, children: error }),
    !snapshot && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u672C\u4F1A\u8BDD\u5B9E\u9A8C\u2026" }),
    snapshot && !jobs.length && !external.length && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { marginTop: 0 }, children: "\u672C\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u5B9E\u9A8C" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u5728\u63D2\u4EF6\u914D\u7F6E\u4E2D\u7ED1\u5B9A\u672C\u4F1A\u8BDD\u7684\u4EFB\u52A1\u3001\u6A21\u578B\u4E0E\u9694\u79BB\u9002\u914D\u5668\u540E\uFF0C\u4F7F\u7528 harness2_run \u542F\u52A8\u5DF2\u914D\u7F6E\u7684 jobId\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { color: "#a8c0b0" }, children: "\u5B89\u88C5\u63D2\u4EF6\u6216\u6253\u5F00\u6B64\u9875\u4E0D\u4F1A\u4EA7\u751F\u6A21\u578B\u8C03\u7528\u3002" })
    ] }),
    jobs.map((job) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", gap: 16 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { style: { overflowWrap: "anywhere" }, children: job.id }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: ["blocked", "failed", "unknown"].includes(job.status) ? "#f79f97" : job.status === "running" ? "#a5edb8" : "#f6d084" }, children: [
          labels[job.status] ?? "\u672A\u77E5",
          " \xB7 ",
          labels[job.phase] ?? "\u672A\u77E5"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u9002\u914D\u5668 ",
          job.adapter
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          job.mode === "parallel" ? "\u5E76\u884C\u63A2\u7D22" : "\u987A\u5E8F\u6539\u8FDB",
          " \xB7 k=",
          job.k ?? "\u2014"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u6A21\u578B ",
          number(job.modelCalls),
          " / ",
          number(job.budget?.modelCalls)
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u8BD5\u8DD1 ",
          number(job.trials),
          " / ",
          number(job.budget?.trials)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u8F93\u5165 ",
          number(job.usage?.inputTokens),
          " tok"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u8F93\u51FA ",
          number(job.usage?.outputTokens),
          " tok"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u7F13\u5B58\u8F93\u5165 ",
          number(job.usage?.cachedTokens),
          " tok"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u7528\u91CF\u5E27 ",
          number(job.usage?.usageSamples),
          " / ",
          number(job.usage?.returnedCalls)
        ] })
      ] }),
      job.result && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Result, { result: job.result }),
      job.timeline?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { style: { marginTop: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: [
          "\u8BD5\u8DD1\u4E0E\u9636\u6BB5\u8BB0\u5F55 \xB7 ",
          job.timeline.length
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", { style: { lineHeight: 1.9, paddingLeft: 22 }, children: job.timeline.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          c.kind === "model" ? "\u6A21\u578B" : "\u8BD5\u8DD1",
          " \xB7 ",
          c.caseId ?? "\u5019\u9009\u4E0E\u53CD\u601D",
          " \xB7 ",
          c.group === "holdout" ? "\u7559\u51FA\u590D\u6D4B" : c.group === "train" ? "\u8BD5\u8DD1\u573A\u666F" : "\u751F\u6210",
          " \xB7 ",
          c.role === "baseline" ? "\u539F\u7248" : c.role === "candidate" ? "\u5019\u9009" : "",
          " \xB7 ",
          c.phase === "returned" ? "\u5DF2\u8FD4\u56DE" : "\u7ED3\u679C\u672A\u786E\u5B9A"
        ] }) }, c.id)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { fontSize: 12, color: "#9ab3a2", marginBottom: 0 }, children: [
        "\u66F4\u65B0 ",
        typeof job.updatedAt === "number" ? new Date(job.updatedAt).toLocaleString() : "\u2014",
        job.stale ? " \xB7 \u5FC3\u8DF3\u8FC7\u671F\uFF0C\u7ED3\u679C\u672A\u77E5" : "",
        " \xB7 \u7ECF\u9A8C ",
        job.memory === "stored" ? "\u5DF2\u5199\u5165\u5BBF\u4E3B\u8BB0\u5FC6" : job.memory === "pending" ? "\u5F85\u786E\u8BA4" : job.memory === "disabled" ? "\u672A\u914D\u7F6E\u5BBF\u4E3B\u8BB0\u5FC6" : "\u2014"
      ] })
    ] }, job.id)),
    external.map((job) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("strong", { children: [
        job.source,
        " / ",
        job.id
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
        labels[job.status] ?? "\u672A\u77E5",
        " \xB7 ",
        labels[job.phase] ?? "\u672A\u77E5",
        " \xB7 \u8BC1\u636E ",
        number(job.result?.evidenceCount),
        " \u6761 \xB7 \u5C1A\u672A\u91C7\u7528"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { style: { color: "#9ab3a2" }, children: "\u8FD0\u884C\u548C\u8BC1\u636E\u7531\u9886\u57DF\u63D2\u4EF6\u7EF4\u62A4\uFF0C\u6B64\u5904\u53EA\u8BFB\u5C55\u793A\u3002" })
    ] }, `${job.source}-${job.id}`))
  ] });
}
function apply(ctx) {
  function Panel({ sessionId }) {
    const [state, setState] = (0, import_react.useState)();
    (0, import_react.useEffect)(() => {
      const controller = new AbortController();
      let timer;
      const refresh = async () => {
        if (controller.signal.aborted) return;
        if (!document.hidden) try {
          const result = await ctx.connection.rpc.call("/api", "harness2/experiments", { sessionId }, controller.signal);
          if (!controller.signal.aborted) setState(result.ok && result.value.sessionId === sessionId ? { sessionId, snapshot: result.value.snapshot } : { sessionId, error: "\u5B9E\u9A8C\u6570\u636E\u6682\u4E0D\u53EF\u7528\u3002" });
        } catch {
          if (!controller.signal.aborted) setState({ sessionId, error: "\u5B9E\u9A8C\u6570\u636E\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u5F53\u524D\u72B6\u6001\u672A\u77E5\u3002" });
        }
        if (!controller.signal.aborted) timer = setTimeout(refresh, 2e3);
      };
      void refresh();
      return () => {
        controller.abort();
        clearTimeout(timer);
      };
    }, [sessionId]);
    const current = state?.sessionId === sessionId ? state : void 0;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExperimentView, { snapshot: current?.snapshot, error: current?.error });
  }
  ctx.slots.inject("conversation.view", () => ctx.slots.register({ name: "conversation.view", id: "harness2-lab", order: 110, label: () => "\u5B9E\u9A8C\u5BA4" }, Panel));
}
return module.exports;}});
