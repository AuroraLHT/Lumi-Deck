import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Select,
  Text,
  Tooltip,
  useColorMode,
} from "@chakra-ui/react";
import {
  LuLayoutGrid,
  LuLock,
  LuMoon,
  LuPlus,
  LuRotateCcw,
  LuSun,
  LuUnlock,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";

import { logout } from "../../clients/auth";
import useAppStore, { DEFAULT_HOSTS } from "../../stores/app";
import useAuthStore from "../../stores/auth";
import useDashboardStore from "../../stores/dashboard";
import { PANEL_REGISTRY, PANEL_TYPES } from "../Dashboard/panelRegistry";
import { SyncStatus } from "../../hooks/useSettingsSync";

interface NavbarProps {
  syncStatus: SyncStatus;
}

const SyncIndicator = ({ status }: { status: SyncStatus }) => {
  if (status === "idle") return null;

  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
      ? "Saved"
      : status === "loading"
      ? "Loading…"
      : "Not saved";

  const color =
    status === "error" ? "status.error" : status === "saved" ? "status.ok" : "text.muted";

  return (
    <Tooltip
      label={
        status === "error"
          ? "Your layout could not be saved to the server."
          : "Layout is stored on the server against your account."
      }
      openDelay={300}
    >
      <Text fontSize="xs" color={color} display={{ base: "none", md: "block" }}>
        {label}
      </Text>
    </Tooltip>
  );
};

const Navbar = ({ syncStatus }: NavbarProps) => {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();

  const user = useAuthStore((s) => s.user);
  const selectedHost = useAppStore((s) => s.selectedHost);
  const setSelectedHost = useAppStore((s) => s.setSelectedHost);
  const customHosts = useAppStore((s) => s.customHosts);

  const addPanel = useDashboardStore((s) => s.addPanel);
  const resetToDefaults = useDashboardStore((s) => s.resetToDefaults);
  const locked = useDashboardStore((s) => s.locked);
  const setLocked = useDashboardStore((s) => s.setLocked);

  const hosts = [...DEFAULT_HOSTS, ...customHosts];

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      gap={3}
      px={{ base: 3, md: 4 }}
      py={2}
      bg="panel.bg"
      borderBottom="1px solid"
      borderColor="panel.border"
      position="sticky"
      top={0}
      zIndex={15}
    >
      {/* Brand + host */}
      <HStack spacing={{ base: 2, md: 4 }} minW={0}>
        <HStack spacing={2} flexShrink={0}>
          <Box w="9px" h="9px" borderRadius="full" bg="accent.solid" />
          <Text
            fontWeight="800"
            letterSpacing="-0.01em"
            display={{ base: "none", sm: "block" }}
          >
            Lumi
          </Text>
        </HStack>

        <Select
          size="sm"
          value={selectedHost}
          onChange={(e) => setSelectedHost(e.target.value)}
          width={{ base: "150px", md: "190px" }}
          borderRadius="lg"
          aria-label="Server"
        >
          {hosts.map((host) => (
            <option key={host} value={host}>
              {host}
            </option>
          ))}
        </Select>
      </HStack>

      {/* Dashboard controls */}
      <HStack spacing={1}>
        <SyncIndicator status={syncStatus} />

        <Menu>
          <Tooltip label="Add panel" openDelay={400}>
            <MenuButton
              as={IconButton}
              aria-label="Add panel"
              icon={<Icon as={LuPlus} />}
              size="sm"
              variant="panelGhost"
            />
          </Tooltip>
          <MenuList>
            <Text px={3} py={1} fontSize="xs" color="text.muted">
              Add a panel
            </Text>
            <MenuDivider />
            {PANEL_TYPES.map((type) => {
              const definition = PANEL_REGISTRY[type];
              return (
                <MenuItem key={type} onClick={() => addPanel(type)}>
                  <Box>
                    <Text fontSize="sm" fontWeight="600">
                      {definition.title}
                    </Text>
                    <Text fontSize="xs" color="text.muted">
                      {definition.description}
                    </Text>
                  </Box>
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>

        <Tooltip
          label={locked ? "Unlock layout" : "Lock layout"}
          openDelay={400}
        >
          <IconButton
            aria-label={locked ? "Unlock layout" : "Lock layout"}
            icon={<Icon as={locked ? LuLock : LuUnlock} />}
            size="sm"
            variant="panelGhost"
            color={locked ? "accent.solid" : undefined}
            onClick={() => setLocked(!locked)}
          />
        </Tooltip>

        <Tooltip label="Reset layout" openDelay={400}>
          <IconButton
            aria-label="Reset layout"
            icon={<Icon as={LuRotateCcw} />}
            size="sm"
            variant="panelGhost"
            onClick={resetToDefaults}
          />
        </Tooltip>

        <Tooltip
          label={colorMode === "dark" ? "Light mode" : "Dark mode"}
          openDelay={400}
        >
          <IconButton
            aria-label="Toggle colour mode"
            icon={<Icon as={colorMode === "dark" ? LuSun : LuMoon} />}
            size="sm"
            variant="panelGhost"
            onClick={toggleColorMode}
          />
        </Tooltip>

        <Divider orientation="vertical" h="20px" mx={1} />

        <Menu>
          <MenuButton
            as={Button}
            variant="panelGhost"
            size="sm"
            px={1}
            aria-label="Account"
          >
            <HStack spacing={2}>
              <Avatar
                size="xs"
                name={user?.full_name || user?.username}
                bg="accent.solid"
                color="ink.950"
              />
              <Text
                fontSize="sm"
                display={{ base: "none", md: "block" }}
                maxW="120px"
                noOfLines={1}
              >
                {user?.username ?? "Account"}
              </Text>
            </HStack>
          </MenuButton>
          <MenuList>
            <Box px={3} py={2}>
              <Text fontSize="sm" fontWeight="600">
                {user?.full_name || user?.username}
              </Text>
              <HStack spacing={2} mt={1}>
                <Text fontSize="xs" color="text.muted">
                  {user?.username}
                </Text>
                {user?.is_admin && (
                  <Badge size="sm" colorScheme="cyan" fontSize="0.6rem">
                    Admin
                  </Badge>
                )}
              </HStack>
            </Box>
            <MenuDivider />
            <MenuItem
              icon={<Icon as={LuLayoutGrid} />}
              onClick={resetToDefaults}
            >
              Reset dashboard
            </MenuItem>
            <MenuItem onClick={handleLogout} color="status.error">
              Sign out
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
};

export default Navbar;
