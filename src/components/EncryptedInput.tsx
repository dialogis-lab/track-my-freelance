import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EncryptedInputProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'textarea';
  className?: string;
  encryptionAvailable?: boolean;
  rows?: number;
}

export function EncryptedInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
  className,
  encryptionAvailable = true,
  rows = 3
}: EncryptedInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const shouldMask = value.length > 0 && !isVisible && !isFocused;
  const displayValue = shouldMask ? '••••••••••••••••' : value;

  const InputComponent = type === 'textarea' ? Textarea : Input;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="flex items-center gap-2">
          {label}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className={cn(
                  'h-3 w-3',
                  encryptionAvailable ? 'text-green-600' : 'text-red-500'
                )} />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {encryptionAvailable 
                    ? 'Stored encrypted at rest' 
                    : 'Encryption not available - input disabled'
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        
        {encryptionAvailable && value.length > 0 && (
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            tabIndex={-1}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      <InputComponent
        id={id}
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={encryptionAvailable ? placeholder : 'Encryption not available'}
        disabled={disabled || !encryptionAvailable}
        className={cn(
          'font-mono',
          !encryptionAvailable && 'opacity-50 cursor-not-allowed',
          shouldMask && 'text-muted-foreground'
        )}
        rows={type === 'textarea' ? rows : undefined}
      />

      {!encryptionAvailable && (
        <p className="text-sm text-red-600">
          Admin must configure encryption keys before this field can be used.
        </p>
      )}
    </div>
  );
}