import { type AdminTask, TASK_TEXT_MAX } from "../../../shared/types";
import { ActionMenu } from "../ui/ActionMenu";
import { useEditor } from "./editor-context";
import { TextEditor } from "./TextEditor";

export function EditorTaskRow({ task }: { task: AdminTask }) {
  const { editing, setEditing, actions, requestHide } = useEditor();

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
    <li className="flex items-start gap-2 py-1 pr-1 pl-4">
      <span aria-hidden="true" className="flex h-11 w-4 shrink-0 items-center">
        <span className="size-1.5 rounded-full bg-idle" />
      </span>
      <span className="min-w-0 flex-1 py-2.5 text-task wrap-anywhere">{task.text}</span>
      <ActionMenu
        label={`Actions for task: ${task.text}`}
        items={[
          { label: "Edit", onSelect: () => setEditing({ kind: "edit-task", taskId: task.id }) },
          {
            label: "Hide task",
            danger: true,
            onSelect: () => requestHide({ kind: "task", id: task.id, name: task.text, details: [] }),
          },
        ]}
      />
    </li>
  );
}
