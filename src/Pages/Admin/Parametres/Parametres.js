import React, { useContext, useState } from 'react';
import './Parametres.css';
import { EtiquettesContext } from '../../../context/EtiquettesContext';

function Parametres() {
  // On récupère tout le contexte
  const {
    articleTags,
    broderieTags,
    saveTags
  } = useContext(EtiquettesContext);

  // Pour la création
  const [newTag, setNewTag] = useState('');
  const [tagType, setTagType] = useState('article');

  // Pour l'édition
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingType, setEditingType] = useState('');
  const [editingValue, setEditingValue] = useState('');

  // Ajouter une étiquette
  const handleAddTag = () => {
    if (!newTag.trim()) return;

    const updatedArticles = [...articleTags];
    const updatedBroderies = [...broderieTags];

    if (tagType === 'article') {
      updatedArticles.push(newTag.trim());
    } else {
      updatedBroderies.push(newTag.trim());
    }

    saveTags(updatedArticles, updatedBroderies);

    setNewTag('');
  };

  // Supprimer une étiquette
  const handleDelete = (type, index) => {
    let updatedArticles = [...articleTags];
    let updatedBroderies = [...broderieTags];

    if (type === 'article') {
      updatedArticles = updatedArticles.filter((_, i) => i !== index);
    } else {
      updatedBroderies = updatedBroderies.filter((_, i) => i !== index);
    }

    saveTags(updatedArticles, updatedBroderies);
  };

  // Lancer la modification
  const handleEdit = (type, index, value) => {
    setEditingIndex(index);
    setEditingType(type);
    setEditingValue(value);
  };

  // Valider la modification
  const handleSaveEdit = () => {
    const updatedArticles = [...articleTags];
    const updatedBroderies = [...broderieTags];

    if (editingType === 'article') {
      updatedArticles[editingIndex] = editingValue.trim();
    } else {
      updatedBroderies[editingIndex] = editingValue.trim();
    }

    saveTags(updatedArticles, updatedBroderies);

    // Reset édition
    setEditingIndex(null);
    setEditingType('');
    setEditingValue('');
  };

  return (
    <div className="parametres-page">
      <h2>Paramètres Etiquettes</h2>

      {/* Section ajout */}
      <div className="ajout-section">
        <input
          type="text"
          placeholder="Nouvelle étiquette"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
        />
        <select value={tagType} onChange={(e) => setTagType(e.target.value)}>
          <option value="article">Type d'article</option>
          <option value="broderie">Option de broderie</option>
        </select>
        <button onClick={handleAddTag} className="btn-enregistrer">
          Ajouter
        </button>
      </div>

      {/* Liste des étiquettes */}
      <div className="tags-list">
        <h3>Types d'article</h3>
        <ul>
          {articleTags.map((tag, index) => (
            <li key={index}>
              {editingType === 'article' && editingIndex === index ? (
                <>
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                  />
                  <button onClick={handleSaveEdit} className="btn-enregistrer">
                    Enregistrer
                  </button>
                  <button
                    onClick={() => {
                      setEditingIndex(null);
                      setEditingType('');
                    }}
                    className="btn-fermer"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <span>{tag}</span>
                  <button onClick={() => handleEdit('article', index, tag)}>✏️</button>
                  <button onClick={() => handleDelete('article', index)}>🗑️</button>
                </>
              )}
            </li>
          ))}
        </ul>

        <h3>Options de broderie</h3>
        <ul>
          {broderieTags.map((tag, index) => (
            <li key={index}>
              {editingType === 'broderie' && editingIndex === index ? (
                <>
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                  />
                  <button onClick={handleSaveEdit} className="btn-enregistrer">
                    Enregistrer
                  </button>
                  <button
                    onClick={() => {
                      setEditingIndex(null);
                      setEditingType('');
                    }}
                    className="btn-fermer"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <span>{tag}</span>
                  <button onClick={() => handleEdit('broderie', index, tag)}>✏️</button>
                  <button onClick={() => handleDelete('broderie', index)}>🗑️</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Parametres;
