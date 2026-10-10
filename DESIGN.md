---
version: alpha
name: SEAES UTSJR
description: Análisis institucional compacto, de lo general al registro.
colors:
  primary: "#009D81"
  primaryAction: "#007762"
  institutional: "#00245A"
  text: "#172B3F"
  muted: "#586B7C"
  border: "#DCE4E8"
  surface: "#FFFFFF"
  background: "#F6F8F9"
typography:
  sans:
    fontFamily: "Segoe UI, Arial, sans-serif"
  data:
    fontFamily: "Segoe UI, Arial, sans-serif"
rounded:
  DEFAULT: "8px"
  control: "6px"
spacing:
  page: "38px"
  compact: "8px"
components:
  button:
    rounded: "6px"
  panel:
    rounded: "8px"
---

# SEAES UTSJR

## Overview

Producto de consulta institucional para la Universidad Tecnológica de San Juan del Río, en español de México. Prioridad de escritorio y tablet. Su referencia es una mesa de revisión académica: una visión de cobertura y acceso a la evidencia, sin reproducir el libro completo en pantalla. La firma visual es la línea verde de navegación y las barras de cobertura numeradas por indicador SEAES.

El encargo del 7 de octubre de 2026 sustituye las seis vistas anteriores por Dashboard, Registros y Archivos. No se cambian las reglas de consolidación, trazabilidad o persistencia. No es una landing comercial ni una hoja de cálculo.

Los tokens canónicos residen en `src/styles.css`; este documento registra su intención y valores aceptados. `primary → --ut-green`, `primaryAction → --ut-green-dark`, `institutional → --ut-blue`, `text → --ink`, `muted → --muted`, `border → --line`, `surface → --surface`, `background → --surface-2`. Las gráficas consumen esos tokens desde `features/dashboard/dashboard.css`.

## Colors

Blanco predominante, verde de marca para datos y selección, azul institucional para títulos. Las acciones sólidas usan verde más oscuro para contraste con texto blanco. Riesgo y error usan `--warning` y `--danger`, acompañados de texto. No se comunica un estado solo con color. Tema claro y soporte a colores forzados del sistema.

## Typography

Segoe UI local, sin descargas de fuentes. Títulos 30px/650, texto 14px, tablas 13px, información secundaria 11–12px. Cifras tabulares en métricas y recuentos. La documentación SEAES extensa se conserva en paneles bajo demanda.

## Layout

Navegación horizontal de tres opciones. Contenido máximo de 1760px; margen de escritorio 38px, tablet 24px y móvil 16px. Seis métricas compactas y un panel analítico. Las barras, leyendas, listas de fuentes y tablas tienen scroll interno. La página no bloquea su propio scroll. Formularios largos tienen scroll propio en el drawer. En 760px la navegación ocupa una segunda fila; las tablas preservan columnas con scroll horizontal.

## Elevation & Depth

Bordes sutiles; sombra mínima en paneles. Elevación reservada a menús, avisos y diálogos. Sin gradientes de fondo ni tarjetas decorativas.

## Shapes

Controles de radio 6px, paneles 8px, diálogos 12px. Símbolo UT con esquinas alternas y sin activos remotos.

## Components

Botones principales para importar, guardar y exportar. Acciones secundarias en menús o detalles. Botones con hover, foco visible y estados deshabilitados. Iconografía Lucide con texto para acciones principales. Tablas HTML semánticas, 25 registros o 20 fuentes por página. Gráficas de barras y anillo utilizan el mismo agregado; el anillo omite segmentos cero, conservando su leyenda salvo que se active Ocultar nulos.

Dialog es el único propietario de modales/drawers y usa showModal, fondo inerte, Escape y retorno de foco. Native select es una elección explícita: el sistema operativo controla su popup y teclado. SearchField ofrece limpieza accesible. Formularios con noValidate y errores propios. Avisos centralizados en App, fuera del flujo de la página. Scrollbars visibles globales y movimiento reducido respetado.

## Do's and Don'ts

- Mostrar primero cobertura, registros y procedencia.
- Mantener todos los detalles disponibles mediante selección, filtros y paneles.
- No restaurar tarjetas individuales por indicador ni navegación adicional.
- No ocultar ceros capturados, cambiar denominadores o alterar exportaciones al ocultar nulos.
