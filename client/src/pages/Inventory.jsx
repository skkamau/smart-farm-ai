import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import InventoryWorkspace from "../components/InventoryWorkspace";
import api from "../services/api";

export default function Inventory() {
  const [animals, setAnimals] = useState([]);
  const [groups, setGroups] = useState([]);
  const [crops, setCrops] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/animals"), api.get("/animal-groups"), api.get("/crops")])
      .then(([animalRes, groupRes, cropRes]) => {
        setAnimals(animalRes.data);
        setGroups(groupRes.data);
        setCrops(cropRes.data);
      })
      .catch(() => toast.error("Some linked farm records could not be loaded"));
  }, []);

  return <InventoryWorkspace animals={animals} groups={groups} crops={crops} />;
}
