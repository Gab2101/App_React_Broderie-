import React from 'react';
import './Banner.css';
import logo from '../../assets/images/Logo_pubos.png';


function Banner() {
  return (
    <div className="banner">
      <img src={logo} alt="Logo de la société" className="logo" />
      <h1>Automatisation du Processus de Broderie</h1>
    </div>
  );
}

export default Banner;