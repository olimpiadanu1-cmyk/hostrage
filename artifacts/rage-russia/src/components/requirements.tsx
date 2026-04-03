const items = [
  "В жалобе нет скриншота с момента выдачи наказания (скриншот от третьего лица не будет учитываться);",
  "В жалобе присутствуют обрезанные, замазанные или же подделанные доказательства;",
  "В жалобе на скриншотах присутствуют запрещенные ПО;",
  "Жалоба написана не по форме;",
  "Дублированная жалоба;",
  "Жалоба была написано от третьего лица;",
  "Реклама (сюда входит также упоминание других проектов);",
  "В жалобе указаны недостоверные данные касательно наказуемого и наказавшего;",
  "В жалобе присутствуют доказательства плохого качества (240p);",
  "С момента выдачи наказания прошло более 3-х дней;",
  "В жалобе отсутствует /time;",
  "Не указаны тайм-коды при видеозаписи, которая длится более 2 минут.",
];

export function Requirements() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <h3 className="font-bold uppercase tracking-widest text-xs text-primary">
          Требования к жалобе
        </h3>
      </div>
      <div className="px-5 py-1.5">
        <p className="text-xs text-muted-foreground py-3 border-b border-border font-medium uppercase tracking-wide">
          Жалоба будет отклонена если:
        </p>
        <ol className="py-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 group"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-sm bg-secondary border border-border flex items-center justify-center text-xs font-bold text-primary mt-0.5 font-mono">
                {index + 1}
              </span>
              <span className="text-sm text-foreground/85 leading-relaxed">
                {item}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
