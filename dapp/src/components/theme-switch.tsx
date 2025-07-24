import { Switch } from "@heroui/switch";
import { useTheme } from "@heroui/use-theme";
import { MoonFilledIcon, SunFilledIcon } from "./icons";

export const ThemeSwitch = () => {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (isSelected: boolean) => {
    setTheme(isSelected ? "dark" : "light");
  };

  return (
    <Switch
      isSelected={theme === "dark"}
      size="sm"
      color="secondary"
      startContent={<SunFilledIcon />}
      endContent={<MoonFilledIcon />}
      onValueChange={handleThemeChange}
    />
  );
}; 