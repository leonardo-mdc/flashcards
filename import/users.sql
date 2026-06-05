-- phpMyAdmin SQL Dump
-- version 4.9.0.1
-- https://www.phpmyadmin.net/
--
-- Host: sql111.infinityfree.com
-- Tempo de geração: 05-Jun-2026 às 17:41
-- Versão do servidor: 11.4.12-MariaDB
-- versão do PHP: 7.2.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `if0_41632431_flashcards`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(30) NOT NULL,
  `full_name` varchar(100) NOT NULL DEFAULT '',
  `password_hash` varchar(255) NOT NULL,
  `is_admin` tinyint(1) DEFAULT 0,
  `progress` int(11) DEFAULT 0,
  `english_level` varchar(50) DEFAULT 'Beginner',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Extraindo dados da tabela `users`
--

INSERT INTO `users` (`id`, `username`, `full_name`, `password_hash`, `is_admin`, `progress`, `english_level`, `created_at`) VALUES
(2, 'felipe', 'Felipe Moreda', '$2y$10$1dz64oAcF5XEJDxdJRr4D.jK.Reo0GREurFm.G3b532aXjrM38VuK', 0, 0, 'Intermediate', '2026-06-03 23:27:16'),
(3, 'rpscheidt', 'Rafael Pscheidt', '$2y$10$U2NWrk2xuWFAoUT4GMC/ZOfRGe5FwrwAXOKpLmLd06O2k.A/ScFBG', 0, 0, 'Intermediate', '2026-06-03 23:28:36'),
(4, 'carolina', 'Carolina Sousa', '$2y$10$1VHJxivAsO9KSIu2oSI8meXWnDuspBM39SBr/.bjaZQ.mufjm0.52', 0, 0, 'Beginner', '2026-06-04 20:18:59');

--
-- Índices para tabelas despejadas
--

--
-- Índices para tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT de tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
