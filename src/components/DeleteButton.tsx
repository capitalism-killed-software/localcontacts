'use client';

export default function DeleteButton({
  action,
  confirmText,
  label = 'Delete',
}: {
  action: (fd: FormData) => void | Promise<void>;
  confirmText: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:border-red-500"
      >
        {label}
      </button>
    </form>
  );
}
