import { type AdminCategory, NAME_MAX } from "../../../shared/types";
import { plural } from "../../lib/checklist";
import { ActionMenu } from "../ui/ActionMenu";
import { Card } from "../ui/Card";
import { Chevron } from "../ui/Chevron";
import { AddButton } from "./AddButton";
import { type Position, RECENT_CLASS, itemKey, menuButtonId, reorderItems, useEditor } from "./editor-context";
import { EditorSection } from "./EditorSection";
import { ReorderButtons } from "./ReorderButtons";
import { TextEditor } from "./TextEditor";

interface Props {
  category: AdminCategory;
  position: Position;
  expanded: boolean;
  onToggle: () => void;
}

export function EditorCategory({ category, position, expanded, onToggle }: Props) {
  const editor = useEditor();
  const { editing, setEditing, actions, requestHide, recent, reordering } = editor;
  const taskCount = category.sections.reduce((n, s) => n + s.tasks.length, 0);
  const renaming = editing?.kind === "rename-category" && editing.categoryId === category.id;
  const addingSection = editing?.kind === "add-section" && editing.categoryId === category.id;
  const panelId = `editor-category-${category.id}`;

  const hideDetails = [
    category.sections.length > 0 ? `Its ${plural(category.sections.length, "section")} and ${plural(taskCount, "task")} will be hidden with it.` : "",
    category.linkCount > 0
      ? `Its ${plural(category.linkCount, "Planning Center link")} will be removed, so those teams or positions no longer point to a department.`
      : "",
  ].filter(Boolean);

  return (
    <Card className="overflow-visible">
      {renaming ? (
        <div className="p-4">
          <TextEditor
            label="Department name"
            initial={category.name}
            maxLength={NAME_MAX}
            onSave={(name) => actions.renameCategory(category.id, name)}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <div
          className={`flex items-center gap-1 rounded-t-card pr-1 transition-colors duration-700 ${expanded ? "" : "rounded-b-card"} ${
            recent === itemKey("category", category.id) ? RECENT_CLASS : ""
          }`}
        >
          <h2 className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex min-h-14 w-full items-center gap-3 rounded-l-card px-4 py-3 text-left transition-colors hover:bg-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg leading-snug font-semibold wrap-anywhere">{category.name}</span>
                <span className="block text-meta text-fg-muted">
                  {plural(category.sections.length, "section")} · {plural(taskCount, "task")}
                </span>
              </span>
              <Chevron open={expanded} />
            </button>
          </h2>
          {reordering ? (
            <ReorderButtons kind="category" id={category.id} name={category.name} position={position} />
          ) : (
            <ActionMenu
              id={menuButtonId("category", category.id)}
              label={`Actions for department: ${category.name}`}
              items={[
                { label: "Rename", onSelect: () => setEditing({ kind: "rename-category", categoryId: category.id }) },
                {
                  label: "Add section",
                  onSelect: () => {
                    if (!expanded) onToggle();
                    setEditing({ kind: "add-section", categoryId: category.id });
                  },
                },
                ...reorderItems(editor, "category", category.id, position),
                {
                  label: "Hide department",
                  danger: true,
                  onSelect: () => requestHide({ kind: "category", id: category.id, name: category.name, details: hideDetails }),
                },
              ]}
            />
          )}
        </div>
      )}

      {expanded && (
        <div id={panelId} className="border-t border-line">
          {category.sections.length === 0 && !addingSection && (
            <p className="px-4 pt-3 text-meta text-fg-muted">No sections yet. Add one to start adding tasks.</p>
          )}
          <div className="divide-y divide-line/70">
            {category.sections.map((section, i) => (
              <EditorSection
                key={section.id}
                section={section}
                categoryId={category.id}
                number={i + 1}
                position={{ first: i === 0, last: i === category.sections.length - 1 }}
              />
            ))}
          </div>
          {!reordering && (
            <div className="border-t border-line/70 px-2 py-2">
              {addingSection ? (
                <div className="p-2">
                  <TextEditor
                    label={`New section in ${category.name}`}
                    maxLength={NAME_MAX}
                    saveLabel="Add section"
                    onSave={(name) => actions.addSection(category.id, name)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : (
                <AddButton label="Add section" onClick={() => setEditing({ kind: "add-section", categoryId: category.id })} />
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
