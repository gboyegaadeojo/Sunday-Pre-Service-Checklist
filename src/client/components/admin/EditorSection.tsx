import { type AdminSection, NAME_MAX, TASK_TEXT_MAX } from "../../../shared/types";
import { plural } from "../../lib/checklist";
import { ActionMenu } from "../ui/ActionMenu";
import { AddButton } from "./AddButton";
import { type Position, RECENT_CLASS, itemKey, menuButtonId, reorderItems, useEditor } from "./editor-context";
import { EditorTaskRow } from "./EditorTaskRow";
import { ReorderButtons } from "./ReorderButtons";
import { TextEditor } from "./TextEditor";

interface Props {
  section: AdminSection;
  categoryId: number;
  /** Display number, from its position (sections aren't numbered in the data). */
  number: number;
  position: Position;
}

export function EditorSection({ section, categoryId, number, position }: Props) {
  const editor = useEditor();
  const { editing, setEditing, actions, requestHide, requestMove, recent, reordering } = editor;
  const renaming = editing?.kind === "rename-section" && editing.sectionId === section.id;
  const addingTask = editing?.kind === "add-task" && editing.sectionId === section.id;

  return (
    <div className="py-2">
      {renaming ? (
        <div className="px-4 py-2">
          <TextEditor
            label="Section name"
            initial={section.name}
            maxLength={NAME_MAX}
            onSave={(name) => actions.renameSection(section.id, name)}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : (
        <div
          className={`flex items-center gap-2 pr-1 pl-4 transition-colors duration-700 ${recent === itemKey("section", section.id) ? RECENT_CLASS : ""}`}
        >
          <h3 className="min-w-0 flex-1 py-2 text-base font-semibold wrap-anywhere">
            <span className="mr-1.5 text-meta font-normal text-fg-muted tabular-nums">{number}.</span>
            {section.name}
          </h3>
          <span className="shrink-0 text-meta text-fg-muted tabular-nums">{plural(section.tasks.length, "task")}</span>
          {reordering ? (
            <ReorderButtons kind="section" id={section.id} name={section.name} position={position} />
          ) : (
            <ActionMenu
              id={menuButtonId("section", section.id)}
              label={`Actions for section: ${section.name}`}
              items={[
                { label: "Rename", onSelect: () => setEditing({ kind: "rename-section", sectionId: section.id }) },
                { label: "Add task", onSelect: () => setEditing({ kind: "add-task", sectionId: section.id }) },
                ...reorderItems(editor, "section", section.id, position),
                { label: "Move to…", onSelect: () => requestMove({ kind: "section", id: section.id, name: section.name, categoryId }) },
                {
                  label: "Hide section",
                  danger: true,
                  onSelect: () =>
                    requestHide({
                      kind: "section",
                      id: section.id,
                      name: section.name,
                      details: section.tasks.length > 0 ? [`Its ${plural(section.tasks.length, "task")} will be hidden with it.`] : [],
                    }),
                },
              ]}
            />
          )}
        </div>
      )}

      {section.tasks.length === 0 && !addingTask && <p className="py-1 pl-9 text-meta text-fg-muted">No tasks yet.</p>}
      <ul>
        {section.tasks.map((task, i) => (
          <EditorTaskRow
            key={task.id}
            task={task}
            categoryId={categoryId}
            sectionId={section.id}
            position={{ first: i === 0, last: i === section.tasks.length - 1 }}
          />
        ))}
      </ul>

      {!reordering && (
        <div className="pl-6">
          {addingTask ? (
            <div className="py-2 pr-4">
              <TextEditor
                label={`New task in ${section.name}`}
                maxLength={TASK_TEXT_MAX}
                multiline
                saveLabel="Add task"
                onSave={(text) => actions.addTask(section.id, text)}
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : (
            <AddButton label="Add task" onClick={() => setEditing({ kind: "add-task", sectionId: section.id })} />
          )}
        </div>
      )}
    </div>
  );
}
