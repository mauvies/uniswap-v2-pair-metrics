import { Download, Expand, MoreVertical, Share } from "../../components/icons/index.ts";
import { IconButton } from "../../components/ui/IconButton.tsx";

const ACTIONS = [
  { label: "Share", Icon: Share },
  { label: "Download", Icon: Download },
  { label: "Expand", Icon: Expand },
  { label: "More options", Icon: MoreVertical },
] as const;

export function HeaderActions() {
  return (
    <div className="flex items-center gap-[22px]">
      {ACTIONS.map(({ label, Icon }) => (
        <IconButton key={label} label={label}>
          <Icon />
        </IconButton>
      ))}
    </div>
  );
}
