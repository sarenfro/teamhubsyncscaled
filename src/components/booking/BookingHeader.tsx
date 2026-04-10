import { Calendar } from "lucide-react";

interface BookingHeaderProps {
  teamName?: string;
}

const BookingHeader = ({ teamName = "Our Team" }: BookingHeaderProps) => {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-booking-hero">
        <Calendar className="h-5 w-5 text-primary-foreground" />
      </div>
      <span className="text-lg font-semibold text-foreground">{teamName}</span>
    </div>
  );
};

export default BookingHeader;
