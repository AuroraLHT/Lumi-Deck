import React from "react";
import { useAppStore } from "../stores/app";
import { Select } from "@chakra-ui/react";

const HostSelector: React.FC = () => {
  const { setSelectedHost } = useAppStore();
  {
    /* Dropdown to select a host */
  }

  return (
    <Select
      placeholder= "Select a host"
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedHost(e.target.value)}
    >
      <option value="localhost:8000">localhost:8000</option>
      <option value="10.229.54.118:8000">10.229.54.118:8000</option>
    </Select>
  );
};

export default HostSelector;
