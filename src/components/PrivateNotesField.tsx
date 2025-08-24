import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PrivateNotesFieldProps {
  notes: string;
  privateNotes: string;
  isPrivate: boolean;
  onNotesChange: (notes: string) => void;
  onPrivateNotesChange: (notes: string) => void;
  onPrivacyChange: (isPrivate: boolean) => void;
  encryptionError?: string | null;
  disabled?: boolean;
}

export function PrivateNotesField({
  notes,
  privateNotes,
  isPrivate,
  onNotesChange,
  onPrivateNotesChange,
  onPrivacyChange,
  encryptionError,
  disabled
}: PrivateNotesFieldProps) {
  const [showNotes, setShowNotes] = useState(true);

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="private-notes"
            checked={isPrivate}
            onCheckedChange={(checked) => onPrivacyChange(checked as boolean)}
            disabled={disabled || !!encryptionError}
          />
          <Label htmlFor="private-notes" className="text-sm font-medium">
            Private notes
          </Label>
        </div>
        
        {isPrivate && (
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-green-600" />
            <span className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded-full">
              🔒 Encrypted
            </span>
          </div>
        )}
        
        {isPrivate && privateNotes && (
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="text-muted-foreground hover:text-foreground"
            title={showNotes ? 'Hide notes' : 'Show notes'}
          >
            {showNotes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isPrivate ? (
        <div className="space-y-2">
          <Textarea
            value={privateNotes}
            onChange={(e) => onPrivateNotesChange(e.target.value)}
            placeholder="Enter private notes (will be encrypted)..."
            rows={3}
            disabled={disabled || !!encryptionError}
            className={showNotes ? '' : 'text-transparent bg-muted'}
            style={showNotes ? {} : { caretColor: 'transparent' }}
          />
          {encryptionError && (
            <p className="text-xs text-orange-600">
              Private notes disabled: {encryptionError}
            </p>
          )}
          {!encryptionError && (
            <p className="text-xs text-muted-foreground">
              Private notes are encrypted and never appear in reports or exports.
            </p>
          )}
        </div>
      ) : (
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Enter notes..."
          rows={3}
          disabled={disabled}
        />
      )}
    </div>
  );
}