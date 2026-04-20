import { useEffect, useMemo, useState } from "react";
import { getChatInsightsSummary } from "./api/insightsApi";

const DAY_OPTIONS = [7, 30, 90];
const CHART_VIEW_OPTIONS = [
  { value: "asks", label: "Questions" },
  { value: "answered", label: "Answered" },
  { value: "missing", label: "Missing Info" },
];

export default function InsightsPage({ selectedClinicName }) {
  const [days, setDays] = useState(7);
  const [chartView, setChartView] = useState("asks");
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        setIsLoading(true);
        setLoadError("");

        const data = await getChatInsightsSummary({
          days,
          limit: 5,
        });

        if (!isMounted) return;
        setSummary(data);
      } catch (error) {
        if (!isMounted) return;
        setSummary(null);
        setLoadError(error.message || "Failed to load insights.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [days]);

  const totalAsks = summary?.totalAsks ?? 16;
  const answerRate =
    typeof summary?.answerRate === "number" ? summary.answerRate : 100;
  const noRelevantDocsCount = summary?.noRelevantDocsCount ?? 0;
  const activeUsersCount =
    summary?.activeUsersCount ??
    summary?.engagedUsersCount ??
    summary?.uniqueUsersCount ??
    null;
  const needsAttentionCount =
    summary?.needsAttentionCount ?? noRelevantDocsCount ?? 0;

  const metricCards = useMemo(() => {
    return [
      {
        key: "questions",
        eyebrow: "Overview",
        value: formatNumber(totalAsks),
        label: "Questions Asked",
        status: "neutral",
        note: "Clinic activity",
      },
      {
        key: "success",
        eyebrow: "Performance",
        value: `${answerRate}%`,
        label: "Success Rate",
        status: "good",
        note: "Questions answered well",
      },
      {
        key: "coverage",
        eyebrow: "Coverage",
        value: formatNumber(noRelevantDocsCount),
        label: "Missing Information",
        status: noRelevantDocsCount > 0 ? "warn" : "neutral",
        note:
          noRelevantDocsCount > 0
            ? "Topics needing more docs"
            : "No major gaps detected",
      },
      {
        key: "adoption",
        eyebrow: "Adoption",
        value: activeUsersCount !== null ? formatNumber(activeUsersCount) : "—",
        label: "Active Users",
        status: "neutral",
        note: "Users engaged this period",
      },
      {
        key: "action",
        eyebrow: "Action",
        value: formatNumber(needsAttentionCount),
        label: "Needs Attention",
        status: needsAttentionCount > 0 ? "warn" : "good",
        note:
          needsAttentionCount > 0
            ? "Items worth reviewing"
            : "Nothing urgent right now",
      },
    ];
  }, [
    totalAsks,
    answerRate,
    noRelevantDocsCount,
    activeUsersCount,
    needsAttentionCount,
  ]);

  const asksTrend = useMemo(() => {
    if (Array.isArray(summary?.dailyAsks) && summary.dailyAsks.length > 0) {
      return summary.dailyAsks.map((item, index) => ({
        label: item?.label || item?.date || `Day ${index + 1}`,
        value: Number(item?.count ?? item?.value ?? 0),
      }));
    }

    return [
      { label: "Mon", value: 2 },
      { label: "Tue", value: 5 },
      { label: "Wed", value: 8 },
      { label: "Thu", value: 11 },
      { label: "Fri", value: 13 },
      { label: "Sat", value: 15 },
      { label: "Sun", value: 16 },
    ];
  }, [summary]);

  const answeredTrend = useMemo(() => {
    if (Array.isArray(summary?.dailyAnswered) && summary.dailyAnswered.length > 0) {
      return summary.dailyAnswered.map((item, index) => ({
        label: item?.label || item?.date || `Day ${index + 1}`,
        value: Number(item?.count ?? item?.value ?? 0),
      }));
    }

    return [
      { label: "Mon", value: 2 },
      { label: "Tue", value: 4 },
      { label: "Wed", value: 7 },
      { label: "Thu", value: 10 },
      { label: "Fri", value: 12 },
      { label: "Sat", value: 14 },
      { label: "Sun", value: 16 },
    ];
  }, [summary]);

  const missingTrend = useMemo(() => {
    if (Array.isArray(summary?.dailyMissing) && summary.dailyMissing.length > 0) {
      return summary.dailyMissing.map((item, index) => ({
        label: item?.label || item?.date || `Day ${index + 1}`,
        value: Number(item?.count ?? item?.value ?? 0),
      }));
    }

    return [
      { label: "Mon", value: 0 },
      { label: "Tue", value: 1 },
      { label: "Wed", value: 1 },
      { label: "Thu", value: 0 },
      { label: "Fri", value: 0 },
      { label: "Sat", value: 0 },
      { label: "Sun", value: 0 },
    ];
  }, [summary]);

  const chartConfig = useMemo(() => {
    if (chartView === "answered") {
      return {
        title: "Usage Trend",
        subtitle: "Answered questions over time for the selected period.",
        data: answeredTrend,
        tone: "good",
      };
    }

    if (chartView === "missing") {
      return {
        title: "Usage Trend",
        subtitle: "Topics with missing information over time for the selected period.",
        data: missingTrend,
        tone: "warn",
      };
    }

    return {
      title: "Usage Trend",
      subtitle: "Questions asked over time for the selected period.",
      data: asksTrend,
      tone: "neutral",
    };
  }, [chartView, asksTrend, answeredTrend, missingTrend]);

  const missingTopics = useMemo(() => {
    const items = summary?.topUnansweredQuestions;
    if (Array.isArray(items) && items.length > 0) {
      return items.map((item) => ({
        label: item?.question || item?.label || "Unknown topic",
        count: Number(item?.count ?? 0),
      }));
    }

    return [];
  }, [summary]);

  const mostUsedDocuments = useMemo(() => {
    const items =
      summary?.topUsedDocuments ||
      summary?.topDocuments ||
      summary?.mostUsedDocuments;

    if (Array.isArray(items) && items.length > 0) {
      return items.map((item) => ({
        label:
          item?.label ||
          item?.name ||
          item?.filename ||
          item?.documentName ||
          "Untitled document",
        count: Number(item?.count ?? item?.value ?? 0),
      }));
    }

    return [
      { label: "Sterilisation SOP", count: 9 },
      { label: "Recall Workflow Guide", count: 6 },
      { label: "Consent Process Procedure", count: 4 },
    ];
  }, [summary]);

  const mostAskedTopics = useMemo(() => {
    const items =
      summary?.topTopics || summary?.mostAskedTopics || summary?.topQuestions;

    if (Array.isArray(items) && items.length > 0) {
      return items.map((item) => ({
        label: item?.question || item?.label || item?.topic || "Unknown topic",
        count: Number(item?.count ?? item?.value ?? 0),
      }));
    }

    return [
      { label: "Sterilisation process", count: 7 },
      { label: "Patient consent", count: 5 },
      { label: "Recall scheduling", count: 4 },
    ];
  }, [summary]);

  const engagementItems = useMemo(() => {
    const high = summary?.highUsageUsersCount;
    const medium = summary?.mediumUsageUsersCount;
    const low = summary?.lowUsageUsersCount;
    const inactive = summary?.inactiveUsersCount;

    if (
      high !== undefined ||
      medium !== undefined ||
      low !== undefined ||
      inactive !== undefined
    ) {
      return [
        { label: "High usage", value: high ?? 0 },
        { label: "Medium usage", value: medium ?? 0 },
        { label: "Low usage", value: low ?? 0 },
        { label: "Inactive", value: inactive ?? 0 },
      ];
    }

    return [
      { label: "High usage", value: 3 },
      { label: "Medium usage", value: 4 },
      { label: "Low usage", value: 2 },
      { label: "Inactive", value: 1 },
    ];
  }, [summary]);

  const snapshotMessage = useMemo(() => {
    if (isLoading) return "Loading insight snapshot…";

    if (noRelevantDocsCount === 0) {
      return "Great news — your clinic documents are covering questions well for this time range.";
    }

    if (noRelevantDocsCount <= 3) {
      return "A small number of repeat topics could not be answered from current clinic documents.";
    }

    return "There are repeated information gaps worth reviewing to improve document coverage.";
  }, [isLoading, noRelevantDocsCount]);

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.headingBlock}>
          <div style={styles.pageEyebrow}>Clinic insights</div>
          <h1 style={styles.title}>Insights</h1>
          <p style={styles.subtitle}>
            {selectedClinicName
              ? `See how Dental Buddy AI is being used in ${selectedClinicName}, where it is helping, and where more documentation may be needed.`
              : "See how Dental Buddy AI is being used, where it is helping, and where more documentation may be needed."}
          </p>
        </div>

        <div style={styles.rangeCard}>
          <div style={styles.rangeLabel}>Time range</div>
          <select
            style={styles.select}
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {DAY_OPTIONS.map((value) => (
              <option key={value} value={String(value)}>
                Last {value} days
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? <div style={styles.errorBox}>{loadError}</div> : null}

      <div style={styles.snapshotCard}>
        <div style={styles.snapshotContent}>
          <div>
            <div style={styles.snapshotEyebrow}>Snapshot</div>
            <div style={styles.snapshotTitle}>What stands out right now</div>
            <div style={styles.snapshotText}>{snapshotMessage}</div>
          </div>

          <div style={styles.snapshotPill}>Last {days} days</div>
        </div>
      </div>

      <div style={styles.metricGrid}>
        {metricCards.map((card) => (
          <MetricCard key={card.key} card={card} isLoading={isLoading} />
        ))}
      </div>

      <SectionCard
        title={chartConfig.title}
        subtitle={chartConfig.subtitle}
        compactHeader={false}
        headerRight={
          <div style={styles.chartToolbar}>
            <div style={styles.chartFilterWrap}>
              {CHART_VIEW_OPTIONS.map((option) => {
                const active = chartView === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setChartView(option.value)}
                    style={{
                      ...styles.chartToggle,
                      ...(active ? styles.chartToggleActive : {}),
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "var(--surface-2)";
                        e.currentTarget.style.borderColor = "var(--border-soft)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                      }
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        }
      >
        <UsageTrendChart
          data={chartConfig.data}
          isLoading={isLoading}
          tone={chartConfig.tone}
        />
      </SectionCard>

      <div style={styles.lowerGrid}>
        <SectionCard
          title="Missing Information"
          subtitle="Repeated topics where Dental Buddy AI could not find enough relevant clinic documentation."
        >
          <InsightList
            items={missingTopics}
            isLoading={isLoading}
            emptyTitle="No coverage gaps detected"
            emptyText="Your clinic documents are covering questions well for this time range."
            tone="warn"
          />
        </SectionCard>

        <SectionCard
          title="Most Used Documents"
          subtitle="Documents that supported answers most often during this period."
        >
          <InsightList
            items={mostUsedDocuments}
            isLoading={isLoading}
            emptyTitle="No document activity yet"
            emptyText="As more questions are asked, the most helpful documents will appear here."
            tone="neutral"
          />
        </SectionCard>

        <SectionCard
          title="Most Asked Topics"
          subtitle="Repeated themes staff are asking about most often."
        >
          <InsightList
            items={mostAskedTopics}
            isLoading={isLoading}
            emptyTitle="No repeated topics yet"
            emptyText="As usage grows, recurring topics will appear here."
            tone="good"
          />
        </SectionCard>

        <SectionCard
          title="Team Engagement"
          subtitle="A simple view of usage distribution across the selected period."
        >
          <EngagementPanel items={engagementItems} isLoading={isLoading} />
        </SectionCard>
      </div>
    </div>
  );
}

function MetricCard({ card, isLoading }) {
  const tone = getToneStyles(card.status);

  return (
    <div style={{ ...styles.metricCard, ...tone.card }}>
      <div style={styles.metricTopRow}>
        <div style={{ ...styles.metricEyebrow, ...tone.eyebrow }}>
          {card.eyebrow}
        </div>
        <div style={{ ...styles.metricDot, ...tone.dot }} />
      </div>

      <div style={styles.metricValue}>{isLoading ? "Loading..." : card.value}</div>
      <div style={styles.metricLabel}>{card.label}</div>
      <div style={styles.metricNote}>{card.note}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  compactHeader = true,
  headerRight = null,
}) {
  return (
    <div style={styles.sectionCard}>
      <div
        style={{
          ...styles.sectionHeader,
          ...(compactHeader ? styles.sectionHeaderCompact : null),
        }}
      >
        <div style={styles.sectionHeaderMain}>
          <h2 style={styles.sectionTitle}>{title}</h2>
          <p style={styles.sectionSubtitle}>{subtitle}</p>
        </div>

        {headerRight ? <div style={styles.sectionHeaderRight}>{headerRight}</div> : null}
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function InsightList({
  items,
  isLoading,
  emptyTitle,
  emptyText,
  tone = "neutral",
}) {
  const badgeTone = getToneStyles(tone);

  if (isLoading) {
    return <div style={styles.emptyState}>Loading insights…</div>;
  }

  if (!items.length) {
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.emptyTitle}>{emptyTitle}</div>
        <div style={styles.emptyText}>{emptyText}</div>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          style={styles.listItem}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.boxShadow = "var(--shadow-soft)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "var(--border-soft)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={styles.listText}>{item.label}</div>
          <div style={{ ...styles.listBadge, ...badgeTone.badge }}>
            {formatNumber(item.count)}
          </div>
        </div>
      ))}
    </div>
  );
}

function EngagementPanel({ items, isLoading }) {
  if (isLoading) {
    return <div style={styles.emptyState}>Loading engagement…</div>;
  }

  if (!items.length) {
    return (
      <div style={styles.emptyWrap}>
        <div style={styles.emptyTitle}>No engagement data yet</div>
        <div style={styles.emptyText}>
          Usage distribution will appear here once more activity is available.
        </div>
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div style={styles.engagementList}>
      {items.map((item) => {
        const percentage =
          total > 0 ? Math.round((Number(item.value || 0) / total) * 100) : 0;

        return (
          <div key={item.label} style={styles.engagementItem}>
            <div style={styles.engagementRow}>
              <div style={styles.engagementLabel}>{item.label}</div>
              <div style={styles.engagementMeta}>
                {formatNumber(item.value)} • {percentage}%
              </div>
            </div>

            <div style={styles.engagementTrack}>
              <div
                style={{
                  ...styles.engagementFill,
                  width: `${Math.max(percentage, total > 0 ? 6 : 0)}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UsageTrendChart({ data, isLoading, tone = "neutral" }) {
  if (isLoading) {
    return <div style={styles.emptyState}>Loading trend…</div>;
  }

  if (!data.length) {
    return (
      <div style={styles.emptyState}>
        No usage trend available for this time range yet.
      </div>
    );
  }

  const chartTone = getChartToneStyles(tone);

  const width = 100;
  const height = 28;
  const max = Math.max(...data.map((point) => point.value), 1);
  const min = Math.min(...data.map((point) => point.value), 0);
  const range = Math.max(max - min, 1);

  const points = data.map((point, index) => {
    const x =
      data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - ((point.value - min) / range) * height;
    return `${x},${y}`;
  });

  const linePath = points.join(" ");
  const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(" ");

  return (
    <div style={styles.chartWrap}>
      <div style={styles.chartCanvas}>
        <svg
          viewBox={`0 0 ${width} ${height + 2}`}
          preserveAspectRatio="none"
          style={styles.chartSvg}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="insights-area-fill-dynamic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartTone.fillTop} stopOpacity="0.24" />
              <stop offset="100%" stopColor={chartTone.fillBottom} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          <polygon points={areaPoints} fill="url(#insights-area-fill-dynamic)" />
          <polyline
            points={linePath}
            fill="none"
            stroke={chartTone.line}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
          />
        </svg>
      </div>

      <div style={styles.chartStatsGrid}>
        {data.map((point, index) => (
          <div key={`${point.label}-${index}`} style={styles.chartStatCard}>
            <div style={styles.chartStatValue}>{formatNumber(point.value)}</div>
            <div style={styles.chartStatLabel}>{point.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getToneStyles(tone) {
  switch (tone) {
    case "good":
      return {
        card: {
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 88%, rgba(34,197,94,0.08)), var(--surface-1))",
        },
        eyebrow: {
          color: "var(--text-secondary)",
        },
        dot: {
          background: "rgba(34,197,94,0.95)",
          boxShadow: "0 0 0 6px rgba(34,197,94,0.12)",
        },
        badge: {
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.22)",
          color: "var(--text-primary)",
        },
      };

    case "warn":
      return {
        card: {
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 88%, rgba(245,158,11,0.08)), var(--surface-1))",
        },
        eyebrow: {
          color: "var(--text-secondary)",
        },
        dot: {
          background: "rgba(245,158,11,0.95)",
          boxShadow: "0 0 0 6px rgba(245,158,11,0.12)",
        },
        badge: {
          background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.22)",
          color: "var(--text-primary)",
        },
      };

    default:
      return {
        card: {
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 94%, rgba(59,130,246,0.04)), var(--surface-1))",
        },
        eyebrow: {
          color: "var(--text-secondary)",
        },
        dot: {
          background: "rgba(226,232,240,0.9)",
          boxShadow: "0 0 0 6px rgba(148,163,184,0.12)",
        },
        badge: {
          background: "var(--icon-bubble-bg)",
          border: "1px solid var(--icon-bubble-border)",
          color: "var(--avatar-text)",
        },
      };
  }
}

function getChartToneStyles(tone) {
  switch (tone) {
    case "good":
      return {
        line: "rgba(34,197,94,0.95)",
        fillTop: "rgba(34,197,94,0.9)",
        fillBottom: "rgba(34,197,94,0.2)",
      };
    case "warn":
      return {
        line: "rgba(245,158,11,0.95)",
        fillTop: "rgba(245,158,11,0.9)",
        fillBottom: "rgba(245,158,11,0.2)",
      };
    default:
      return {
        line: "var(--text-primary)",
        fillTop: "var(--text-primary)",
        fillBottom: "var(--text-primary)",
      };
  }
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return "—";
  return new Intl.NumberFormat().format(number);
}

const styles = {
  page: {
    width: "100%",
    paddingBottom: "28px",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  headingBlock: {
    flex: 1,
    minWidth: 0,
    maxWidth: "980px",
  },
  pageEyebrow: {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: "10px",
  },
  title: {
    margin: 0,
    fontSize: "42px",
    lineHeight: 1.02,
    fontWeight: "800",
    letterSpacing: "-0.04em",
    color: "var(--text-primary)",
  },
  subtitle: {
    margin: "12px 0 0 0",
    fontSize: "15px",
    lineHeight: 1.7,
    color: "var(--text-muted)",
    maxWidth: "900px",
  },
  rangeCard: {
    width: "244px",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 96%, rgba(59,130,246,0.03)), var(--surface-1))",
    border: "1px solid var(--border-soft)",
    borderRadius: "20px",
    padding: "16px",
    boxShadow: "var(--shadow-soft)",
  },
  rangeLabel: {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: "12px",
  },
  select: {
    width: "100%",
    padding: "13px 14px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
  },
  errorBox: {
    background: "rgba(239,68,68,0.10)",
    border: "1px solid rgba(248,113,113,0.24)",
    color: "var(--danger-text)",
    borderRadius: "16px",
    padding: "14px 16px",
    fontSize: "14px",
    marginBottom: "18px",
  },
  snapshotCard: {
    background:
      "linear-gradient(90deg, color-mix(in srgb, var(--surface-1) 96%, rgba(37,99,235,0.08)), color-mix(in srgb, var(--surface-1) 92%, rgba(37,99,235,0.03)))",
    border: "1px solid var(--border-soft)",
    borderRadius: "24px",
    padding: "22px 24px",
    boxShadow: "var(--shadow-soft)",
    marginBottom: "22px",
  },
  snapshotContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
  },
  snapshotEyebrow: {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: "8px",
  },
  snapshotTitle: {
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: "800",
    letterSpacing: "-0.02em",
    color: "var(--text-primary)",
  },
  snapshotText: {
    marginTop: "10px",
    fontSize: "15px",
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    maxWidth: "760px",
  },
  snapshotPill: {
    padding: "11px 14px",
    borderRadius: "999px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },
  metricCard: {
    border: "1px solid var(--border-soft)",
    borderRadius: "22px",
    padding: "18px 18px 16px 18px",
    boxShadow: "var(--shadow-soft)",
    minHeight: "142px",
  },
  metricTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  metricEyebrow: {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  metricDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },
  metricValue: {
    fontSize: "32px",
    lineHeight: 1,
    fontWeight: "800",
    letterSpacing: "-0.04em",
    color: "var(--text-primary)",
  },
  metricLabel: {
    marginTop: "10px",
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  metricNote: {
    marginTop: "6px",
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  sectionCard: {
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 98%, rgba(255,255,255,0.01)), var(--surface-1))",
    border: "1px solid var(--border-soft)",
    borderRadius: "24px",
    boxShadow: "var(--shadow-soft)",
    overflow: "hidden",
    marginBottom: "22px",
  },
  sectionHeader: {
    padding: "22px 24px 16px 24px",
    borderBottom: "1px solid var(--divider)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  sectionHeaderCompact: {
    padding: "20px 22px 14px 22px",
  },
  sectionHeaderMain: {
    minWidth: 0,
    flex: 1,
  },
  sectionHeaderRight: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.2,
    fontWeight: "800",
    letterSpacing: "-0.02em",
    color: "var(--text-primary)",
  },
  sectionSubtitle: {
    margin: "10px 0 0 0",
    fontSize: "14px",
    lineHeight: 1.7,
    color: "var(--text-muted)",
  },
  sectionBody: {
    padding: "18px 22px 22px 22px",
  },
  chartToolbar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  chartFilterWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "999px",
  },
  chartToggle: {
    background: "transparent",
    border: "1px solid transparent",
    color: "var(--text-secondary)",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
  },
  chartToggleActive: {
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-1) 92%, rgba(59,130,246,0.06)), var(--surface-1))",
    color: "var(--text-primary)",
    border: "1px solid var(--border-soft)",
    boxShadow: "var(--shadow-soft)",
  },
  chartWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  chartCanvas: {
    height: "180px",
    borderRadius: "18px",
    border: "1px solid var(--border-soft)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 96%, rgba(37,99,235,0.03)), var(--surface-2))",
    padding: "14px",
    overflow: "hidden",
  },
  chartSvg: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  chartStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "10px",
  },
  chartStatCard: {
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "14px",
    padding: "10px 12px",
  },
  chartStatValue: {
    fontSize: "16px",
    fontWeight: "800",
    lineHeight: 1.1,
    color: "var(--text-primary)",
  },
  chartStatLabel: {
    marginTop: "6px",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  lowerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    alignItems: "start",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-soft)",
    borderRadius: "16px",
    padding: "14px 16px",
    transition:
      "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
  },
  listText: {
    flex: 1,
    minWidth: 0,
    color: "var(--text-secondary)",
    fontSize: "14px",
    lineHeight: 1.7,
    wordBreak: "break-word",
  },
  listBadge: {
    minWidth: "38px",
    height: "38px",
    padding: "0 12px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "800",
    flexShrink: 0,
  },
  emptyState: {
    color: "var(--text-muted)",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  emptyWrap: {
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "8px",
  },
  emptyTitle: {
    fontSize: "16px",
    fontWeight: "800",
    color: "var(--text-primary)",
  },
  emptyText: {
    fontSize: "14px",
    lineHeight: 1.7,
    color: "var(--text-muted)",
    maxWidth: "560px",
  },
  engagementList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  engagementItem: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  engagementRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  engagementLabel: {
    fontSize: "14px",
    fontWeight: "700",
    color: "var(--text-primary)",
  },
  engagementMeta: {
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  engagementTrack: {
    width: "100%",
    height: "10px",
    borderRadius: "999px",
    border: "1px solid var(--border-soft)",
    background: "var(--surface-2)",
    overflow: "hidden",
  },
  engagementFill: {
    height: "100%",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, rgba(59,130,246,0.55), rgba(96,165,250,0.95))",
  },
};