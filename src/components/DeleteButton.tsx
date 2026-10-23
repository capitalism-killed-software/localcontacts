'use client';

// Its own form, so it must sit beside the edit form rather than inside it.
export default function DeleteButton({
  action,
  confirmText,
  label = 'Delete Card…',
}: {
  action: (fd: FormData) => void | Promise<void>;
  confirmText: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      className="delete-form"
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className="btn btn-delete">
        {label}
      </button>
    </form>
  );
}
