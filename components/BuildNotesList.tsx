import { parseBuildNoteSections } from "@/lib/buildNotes";
import { sanitizePublicBuildNotes } from "@/lib/buildPrivacy";

export function BuildNotesList({ notes }: { notes: string | null }) {
  const sanitized = sanitizePublicBuildNotes(notes);
  const sections = parseBuildNoteSections(sanitized ?? "");
  if (!sections.length) return null;

  if (sections.length === 1 && !sections[0].heading && sections[0].items.length === 1) {
    return <p className="lead build-notes">{sections[0].items[0]}</p>;
  }

  return (
    <div className="build-notes-list">
      {sections.map((section) => (
        <section key={`${section.heading ?? "notes"}:${section.items[0] ?? ""}`}>
          {section.heading ? <h2>{section.heading}</h2> : null}
          {section.items.length ? (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
