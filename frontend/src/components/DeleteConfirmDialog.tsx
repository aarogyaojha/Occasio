import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  itemLabel?: string;
  isDeleting?: boolean;
  title?: string;
  description?: React.ReactNode;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  itemLabel,
  isDeleting = false,
  title = 'Delete Event',
  description,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 font-mono">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 text-base font-bold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs mt-1">
            {description ?? (
              <>
                Are you sure you want to delete{' '}
                {itemLabel ? (
                  <span className="text-zinc-200 font-semibold">"{itemLabel}"</span>
                ) : (
                  'this item'
                )}
                ? This action cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-sm text-xs uppercase font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 rounded-sm text-xs uppercase font-bold"
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
