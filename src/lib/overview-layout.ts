export const widgetIds = ['leads', 'ready', 'conversations', 'practice', 'activity', 'pipeline', 'roadmap', 'lesson', 'calendar', 'recent', 'credits'] as const;
export type WidgetId = typeof widgetIds[number];
export type WidgetSize = 'compact' | 'wide' | 'full';
export interface WidgetLayout { id: WidgetId; size: WidgetSize; width?: number; height?: number }
export interface Milestone { id: string; title: string; completed: boolean }
export interface OverviewPreferences { version: 1; widgets: WidgetLayout[]; milestones: Milestone[]; lesson: { inventoryId: string; lessonId: string } | null; completedLessons: string[] }
export const widgetCatalog: Record<WidgetId, { title: string; description: string; category: string; size: WidgetSize }> = {
  leads: { title: 'Your leads', description: 'Your saved leads, ready to work with.', category: 'Numbers', size: 'compact' },
  ready: { title: 'Ready for outreach', description: 'New and queued leads, excluding blocked contacts.', category: 'Numbers', size: 'compact' },
  conversations: { title: 'Conversations', description: 'Completed conversations in your latest saved sessions.', category: 'Numbers', size: 'compact' },
  practice: { title: 'Practice minutes', description: 'Time spent practicing your conversations.', category: 'Numbers', size: 'compact' },
  activity: { title: 'Conversation activity', description: 'Your rhythm over time, with a live, interactive activity curve.', category: 'Performance', size: 'wide' },
  pipeline: { title: 'Your pipeline', description: 'See every opportunity, from first contact to a closed deal.', category: 'Performance', size: 'compact' },
  roadmap: { title: 'Your roadmap', description: 'Turn your goals into personal milestones you can check off.', category: 'Learning', size: 'wide' },
  lesson: { title: 'Next up in Academy', description: 'Keep a lesson in focus. Watch its video right from your dashboard.', category: 'Learning', size: 'compact' },
  calendar: { title: 'Next coaching call', description: 'Your next scheduled session, with a shortcut to join.', category: 'Your space', size: 'compact' },
  recent: { title: 'Recent conversations', description: 'Pick up where you left off with your latest completed sessions.', category: 'Performance', size: 'compact' },
  credits: { title: 'NBC Credits', description: 'Your available balance and a shortcut to your credit history.', category: 'Your space', size: 'compact' },
};
export function defaultOverview(): OverviewPreferences {
  return { version: 1, widgets: widgetIds.map(id => ({ id, size: widgetCatalog[id].size, ...({activity:{width:8,height:5},pipeline:{width:4,height:5},roadmap:{width:4,height:5},lesson:{width:8,height:5}} as Partial<Record<WidgetId,{width:number;height:number}>>)[id] })), milestones: [], lesson: null, completedLessons: [] };
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export function parseOverview(raw: string | null): OverviewPreferences {
  const fallback = defaultOverview(); if (!raw || raw.length > 50000) return fallback;
  try {
    const data: unknown = JSON.parse(raw); if (!object(data) || data.version !== 1 || !Array.isArray(data.widgets)) return fallback;
    const seen = new Set<string>();
    const migrated = data.widgets.flatMap(w => object(w) && w.id === 'metrics' ? (['leads','ready','conversations','practice'] as WidgetId[]).map(id => ({id,size:'compact'})) : [w]);
    const widgets: WidgetLayout[] = migrated.filter((w): w is WidgetLayout => object(w) && widgetIds.includes(w.id as WidgetId) && ['compact', 'wide', 'full'].includes(String(w.size)) && !seen.has(String(w.id)) && Boolean(seen.add(String(w.id)))).map(w => ({ id: w.id, size: w.size, ...(Number.isInteger(w.width) && w.width! >= 3 && w.width! <= 12 ? {width:w.width}:{}), ...(Number.isInteger(w.height) && w.height! >= 2 && w.height! <= 12 ? {height:w.height}:{}) }));
    // Upgrade only the old default learning pair; keep custom sizes and personal content.
    const roadmap = widgets.find(w => w.id === 'roadmap'), academy = widgets.find(w => w.id === 'lesson');
    if (roadmap?.width === 6 && roadmap.height === 5 && academy?.width === 6 && [5,7].includes(academy.height ?? 0)) {
      roadmap.width = 4; academy.width = 8; academy.height = 5;
    }
    const milestoneIds = new Set<string>();
    const milestones: Milestone[] = (Array.isArray(data.milestones) ? data.milestones : []).filter((m): m is Milestone => object(m) && typeof m.id === 'string' && m.id.length <= 80 && typeof m.title === 'string' && m.title.trim().length > 0 && m.title.length <= 120 && typeof m.completed === 'boolean' && !milestoneIds.has(m.id) && Boolean(milestoneIds.add(m.id))).slice(0, 30).map(m => ({ id: m.id, title: m.title.trim(), completed: m.completed }));
    const lesson = object(data.lesson) && typeof data.lesson.inventoryId === 'string' && typeof data.lesson.lessonId === 'string' && data.lesson.inventoryId.length <= 100 && data.lesson.lessonId.length <= 100 ? { inventoryId: data.lesson.inventoryId, lessonId: data.lesson.lessonId } : null;
    return { version: 1, widgets, milestones, lesson, completedLessons: Array.isArray(data.completedLessons) ? data.completedLessons.filter((x): x is string => typeof x === 'string' && x.length <= 205).slice(-300) : [] };
  } catch { return fallback; }
}
export const sizeUnits: Record<WidgetSize, number> = { compact: 2, wide: 4, full: 6 };
// Consecutive rows preserve reading/keyboard order. Flex distributes remaining width, so there are no empty cells.
export function packWidgets(widgets: WidgetLayout[], columns = 6): WidgetLayout[][] {
  const rows: WidgetLayout[][] = []; let row: WidgetLayout[] = []; let used = 0;
  for (const widget of widgets) { const span = Math.min(columns, sizeUnits[widget.size]); if (used + span > columns && row.length) { rows.push(row); row = []; used = 0; } row.push(widget); used += span; }
  if (row.length) rows.push(row); return rows;
}
export function moveWidget(widgets: WidgetLayout[], id: WidgetId, target: WidgetId): WidgetLayout[] {
  const from = widgets.findIndex(w => w.id === id), to = widgets.findIndex(w => w.id === target); if (from < 0 || to < 0 || from === to) return widgets;
  const next = [...widgets]; next.splice(to, 0, next.splice(from, 1)[0]); return next;
}
export function smoothLine(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  // Horizontal tangents keep each Bezier segment inside its two observed values (no invented overshoot).
  return points.slice(1).reduce((path, point, i) => { const previous = points[i], middle = (previous.x + point.x) / 2; return `${path} C${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`; }, `M${points[0].x},${points[0].y}`);
}
export function lessonMedia(raw?: string): { kind: 'embed' | 'video' | 'link'; url: string } | null {
  if (!raw) return null;
  try {
    const url = new URL(raw); if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /(^|\.)(localhost|local|internal)$/.test(url.hostname) || /^\d+(\.\d+){3}$/.test(url.hostname) || url.hostname.includes(':')) return null;
    let id: string | null = null;
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)) id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)$/)?.[1] ?? null;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (id && /^[\w-]{11}$/.test(id)) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) { const video = url.pathname.match(/^\/(?:video\/)?(\d+)$/)?.[1]; if (video) return { kind: 'embed', url: `https://player.vimeo.com/video/${video}` }; }
    return { kind: /\.(mp4|webm)$/i.test(url.pathname) ? 'video' : 'link', url: url.href };
  } catch { return null; }
}

export const isNumberWidget = (id: WidgetId): boolean => ['leads','ready','conversations','practice'].includes(id);
export function widgetDimensions(widget: WidgetLayout): { width: number; height: number } {
  const number = isNumberWidget(widget.id), size = widget.size;
  const defaults = number ? {compact:[3,2],wide:[6,2],full:[6,3]} : {compact:[4,4],wide:[6,5],full:[12,6]};
  const [width,height] = defaults[size];
  const actualWidth=widget.width ?? width;
  return {width:actualWidth,height:widget.height??height};
}
export interface WidgetPlacement { widget: WidgetLayout; x: number; y: number; width: number; height: number }
// Fill consecutive rows in reading order. Shared row heights prevent vertical holes.
export function placeWidgets(widgets: WidgetLayout[], columns = 12, canvasWidth = 1112, gap = 16): WidgetPlacement[] {
  const rows: { widget: WidgetLayout; width: number; height: number }[][] = [];
  let row: typeof rows[number] = [], used = 0;
  for (const widget of widgets) {
    const d = widgetDimensions(widget);
    const width = Math.min(columns, columns <= 6 && !isNumberWidget(widget.id) ? columns : columns === 8 ? (d.width <= 4 ? 4 : 8) : d.width);
    if (row.length && (used + width > columns || isNumberWidget(row[0].widget.id) !== isNumberWidget(widget.id))) {
      rows.push(row); row = []; used = 0;
    }
    row.push({widget,width,height:d.height}); used += width;
  }
  if (row.length) rows.push(row);
  const result: WidgetPlacement[] = []; let y = 0;
  for (const entries of rows) {
    const total = entries.reduce((sum,e) => sum + e.width,0);
    let x = 0, cumulative = 0;
    const placed = entries.map(entry => {
      cumulative += entry.width;
      const end = Math.round(cumulative / total * columns), width = end - x;
      const contentWidth = (canvasWidth + gap) * width / columns - gap - 42;
      // Wide Academy cards place a 16:9 frame next to the copy. Narrow cards stack.
      const academyPixels = contentWidth >= 560 ? contentWidth * .58 * 9 / 16 + 90 : contentWidth * 9 / 16 + 220;
      const height = entry.widget.id === 'lesson' ? Math.max(entry.height, Math.ceil((academyPixels + gap) / (56 + gap))) : entry.height;
      const placed = {widget:entry.widget,x,y,width,height}; x = end; return placed;
    });
    const height = Math.max(...placed.map(p=>p.height));
    result.push(...placed.map(p=>({...p,height}))); y += height;
  }
  return result;
}
