import axios from "axios";
import useAppStore from "../stores/app";

// TODO: Add auth
// TODO: oop http client
// add interceptors, handleResponse, handleError

const useHTTPClient = () => {
    const selectedHost = useAppStore(s => s.selectedHost);
    // console.log("Selected host:", selectedHost);
    const baseURL = "http://" + selectedHost;
    // const baseURL = "http://10.229.54.16:8000";
    const client = axios.create({
        baseURL: baseURL,
        headers: {
            "Content-Type": "application/json",
        },
        timeout: 10000,
        withCredentials: false,
    });
    // console.log("Base URL:", baseURL);

    return client;
};

export default useHTTPClient;