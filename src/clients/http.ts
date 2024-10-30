import axios from "axios";
import useAppStore from "../stores/app";

// TODO: Add auth
// TODO: oop http client
// add interceptors, handleResponse, handleError

const useHTTPClient = () => {
    const selectedHost = useAppStore(s => s.selectedHost);
    // console.log("Selected host:", selectedHost);
    const client = axios.create({
        baseURL: "http://" + selectedHost,
        headers: {
            "Content-Type": "application/json",
        },
    });

    return client;
};

export default useHTTPClient;