import { useState } from "react";
import { Button } from "../ui/button.js";
import { Calendar } from "../ui/calendar.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";

type Props = { onSelect: (date: Date) => void };

export default function DatePickerButton({ onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Pick a date
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          onSelect={(date) => {
            if (date) {
              onSelect(date);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
