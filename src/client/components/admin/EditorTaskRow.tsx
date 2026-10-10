import { type AdminTask, TASK_TEXT_MAX } from "../../../shared/types";
import { ActionMenu } from "../ui/ActionMenu";
import { type Position, RECENT_CLASS, itemKey, menuButtonId, reorderItems, useEditor } from "./editor-context";
import { ReorderButtons } from "./ReorderButtons";
import { TextEditor } from "./TextEditor";

interface Props {
  task: AdminTask;
  categoryId: number;
  sectionId: number;
  position: Position;
}

export function EditorTaskRow({ task, categoryId, sectionId, position }: Props) {
  const editor = useEditor();
  const { editing, setEditing, actions, requestHide, requestMove, recent, reordering } = editor;

  if (editing?.kind === "edit-task" && editing.taskId === task.id) {
    return (
      <li className="px-4 py-3">
        <TextEditor
          label="Task"
          initial={task.text}
          maxLength={TASK_TEXT_MAX}
          multiline
          onSave={(text) => actions.editTask(task.id, text)}
          onCancel={() => setEditing(null)}
        />
      </li>
    );
  }

  return (
    <li
      className={`flex items-start gap-2 py-1 pr-1 pl-4 transition-colors duration-700 ${recent === itemKey("task", task.id) ? RECENT_CLASS : ""}`}
    >
      <span aria-hidden="true" className="flex h-11 w-4 shrink-0 items-center">
        <span className="size-1.5 rounded-full bg-idle" />
      </span>
      <span className="min-w-0 flex-1 py-2.5 text-task wrap-anywhere">{task.text}</span>
      {reordering ? (
        <ReorderButtons kind="task" id={task.id} name={task.text} position={position} />
      ) : (
        <ActionMenu
          id={menuButtonId("task", task.id)}
          label={`Actions for task: ${task.text}`}
          items={[
            { label: "Edit", onSelect: () => setEditing({ kind: "edit-task", taskId: task.id }) },
            ...reorderItems(editor, "task", task.id, position),
            { label: "Move to…", onSelect: () => requestMove({ kind: "task", id: task.id, name: task.text, categoryId, sectionId }) },
            {
              label: "Hide task",
              danger: true,
              onSelect: () => requestHide({ kind: "task", id: task.id, name: task.text, details: [] }),
            },
          ]}
        />
      )}
    </li>
  );
}
