import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand-gradient text-white rounded-xl shadow-brand-soft hover:shadow-brand hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 shadow-brand-soft",
        outline:
          "border border-input bg-background rounded-xl hover:bg-accent hover:text-accent-foreground hover:border-primary/50",
        secondary:
          "bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 shadow-sm",
        ghost: "rounded-xl hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline link-gradient rounded-none",
        gradient: "bg-brand-gradient text-white rounded-xl shadow-brand-soft hover:shadow-brand hover:-translate-y-0.5 font-medium",
        "gradient-outline": "border-2 border-transparent bg-clip-padding rounded-xl hover:bg-brand-subtle text-primary hover:text-primary-end font-medium relative overflow-hidden",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-8 text-base font-medium",
        icon: "h-10 w-10",
        xl: "h-14 px-10 text-lg font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
