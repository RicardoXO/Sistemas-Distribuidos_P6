import axios from 'axios';

// Creamos una instancia configurada de Axios
const api = axios.create({
  //baseURL: 'http://localhost:8000/',
  baseURL: 'https://api-recetas-seguras.onrender.com',
});


export default api;