import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { TargetCompanyWithStats } from "./types";

interface DeleteCompanyDialogProps {
  company: TargetCompanyWithStats | null;
  onConfirm: (id: number) => void;
  onCancel: () => void;
  isPending?: boolean;
}

const DeleteCompanyDialog: React.FC<DeleteCompanyDialogProps> = ({
  company,
  onConfirm,
  onCancel,
  isPending,
}) => {
  const [confirmText, setConfirmText] = useState("");

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmText("");
      onCancel();
    }
  };

  const handleConfirm = () => {
    if (company && confirmText === "DELETE") {
      onConfirm(company.id);
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={!!company} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Delete company</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              You are about to permanently delete <strong>{company?.companyName}</strong> and all associated data including contacts, documents, activities, deal documents, and financial data.
            </span>
            <span className="block font-medium text-foreground">
              This cannot be undone.
            </span>
            <span className="block">
              Type <strong>DELETE</strong> to confirm.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
          placeholder="Type DELETE to confirm"
          className="mt-2"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && confirmText === 'DELETE') handleConfirm();
          }}
        />
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirmText !== "DELETE" || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteCompanyDialog;
